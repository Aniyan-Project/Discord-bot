import {
  createClient,
  BranilistOAuth,
  GraphQLRequestError,
  HTTPError,
  OAuthError,
  type BranilistClient,
  type ListStatus,
} from '@aniyan-project/branilist-api'
import type { Config } from './config.js'
import type { Store, AccountTokens } from './store.js'
import { AppError } from './security.js'
import { demoMedia } from '../shared/example-media.js'
import type { MediaCard, ProfileCard } from '../shared/domain.js'

export const accountScopes = [
  'profile:read',
  'library:read',
  'library:write',
  'favourites:read',
  'collections:read',
] as const
const mediaFields = {
  id: true,
  slug: true,
  type: true,
  title: { romaji: true, english: true, portuguese: true, native: true },
  description: true,
  coverImage: true,
  bannerImage: true,
  episodes: true,
  chapters: true,
  averageScore: true,
  seasonYear: true,
  status: true,
  format: true,
  isAdult: true,
} as const
export interface LibraryItem {
  mediaId: string
  progress: number
  status: ListStatus
  score: number | null
  media: MediaCard | null
}
export class BranilistService {
  readonly oauth: BranilistOAuth | null
  private readonly catalog: BranilistClient
  private readonly refreshing = new Map<string, Promise<AccountTokens>>()
  private readonly cache = new Map<
    string,
    {
      until: number
      value: { nodes: MediaCard[]; pageInfo: { hasNextPage: boolean; limit: number; offset: number } }
    }
  >()
  private demoEntries: LibraryItem[] = []
  constructor(
    readonly config: Config,
    private readonly store: Store,
  ) {
    this.catalog = createClient({
      endpoint: config.BRANILIST_GRAPHQL_URL,
      ...(config.BRANILIST_API_KEY ? { apiKey: config.BRANILIST_API_KEY } : {}),
      timeoutMs: 12000,
      retry: { maxRetries: 1 },
    })
    this.oauth = config.BRANILIST_CLIENT_ID
      ? new BranilistOAuth({
          clientId: config.BRANILIST_CLIENT_ID,
          redirectUri: `${config.APP_URL}/auth/branilist/callback`,
          issuer: config.BRANILIST_ISSUER,
          ...(config.BRANILIST_CLIENT_SECRET ? { clientSecret: config.BRANILIST_CLIENT_SECRET } : {}),
        })
      : null
    this.demoEntries = demoMedia.slice(0, 3).map((media, i) => ({
      mediaId: media.id,
      progress: [12, 4, 8][i] ?? 0,
      status: 'CURRENT',
      score: null,
      media,
    }))
  }
  async withErrors<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action()
    } catch (error) {
      if (error instanceof AppError) throw error
      if (error instanceof HTTPError && error.status === 429) throw new AppError(429, 'rateLimited')
      if ((error instanceof HTTPError && error.status === 401) || error instanceof OAuthError)
        throw new AppError(401, 'reconnect')
      if (error instanceof GraphQLRequestError) {
        if (error.codes.includes('UNAUTHENTICATED')) throw new AppError(401, 'reconnect')
        if (error.codes.includes('FORBIDDEN')) throw new AppError(403, 'missingScope')
        if (error.codes.includes('BAD_USER_INPUT')) throw new AppError(400, 'invalidInput')
      }
      throw new AppError(502, 'requestFailed')
    }
  }
  async search(search = '', type?: 'ANIME' | 'MANGA', offset = 0) {
    if (this.config.DEMO_MODE) {
      const items = demoMedia.filter(
        (m) =>
          (!type || m.type === type) &&
          Object.values(m.title).some((t) => t?.toLowerCase().includes(search.toLowerCase())),
      )
      return {
        nodes: items.slice(offset, offset + 12),
        pageInfo: { limit: 12, offset, hasNextPage: items.length > offset + 12 },
      }
    }
    const key = JSON.stringify([search, type, offset])
    const cached = this.cache.get(key)
    if (cached && cached.until > Date.now()) return cached.value
    const result = await this.withErrors(() =>
      this.catalog.query({
        mediaPage: {
          __args: { search: search || undefined, type, offset, first: 12 },
          nodes: mediaFields,
          pageInfo: { limit: true, offset: true, hasNextPage: true },
        },
      }),
    )
    const value = { ...result.mediaPage, nodes: result.mediaPage.nodes.filter((m) => !m.isAdult) }
    if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!)
    this.cache.set(key, { value, until: Date.now() + 30000 })
    return value
  }
  async media(id: string, provider: 'branilist' | 'mal' | 'anilist' = 'branilist'): Promise<MediaCard> {
    if (this.config.DEMO_MODE) {
      const media = demoMedia.find((m) => m.id === id)
      if (!media) throw new AppError(404, 'notFound')
      return media
    }
    const args = provider === 'mal' ? { malId: id } : provider === 'anilist' ? { anilistId: id } : { id }
    const result = await this.withErrors(() =>
      this.catalog.query({ media: { __args: args, ...mediaFields } }),
    )
    if (!result.media || result.media.isAdult) throw new AppError(404, 'notFound')
    return result.media
  }
  async trending(type: 'ANIME' | 'MANGA' = 'ANIME'): Promise<MediaCard[]> {
    if (this.config.DEMO_MODE) return demoMedia.filter((m) => m.type === type)
    const result = await this.withErrors(() =>
      this.catalog.query({ trendingMedia: { __args: { type, first: 10, days: 30 }, ...mediaFields } }),
    )
    return result.trendingMedia.filter((m) => !m.isAdult)
  }
  private async freshTokens(discordId: string): Promise<AccountTokens> {
    const tokens = this.store.account(discordId)
    if (!tokens) throw new AppError(401, 'linkRequired')
    if (tokens.expiresAt > Date.now() + 60000) return tokens
    const existing = this.refreshing.get(discordId)
    if (existing) return existing
    const pending = (async () => {
      if (!this.oauth) throw new AppError(503, 'oauthUnavailable')
      try {
        const rotated = await this.oauth.refreshToken(tokens.refresh_token)
        const updated = {
          ...tokens,
          access_token: rotated.access_token,
          refresh_token: rotated.refresh_token,
          expiresAt: Date.now() + rotated.expires_in * 1000,
          scopes: rotated.scope.split(/\s+/).filter(Boolean),
        }
        this.store.putAccount(discordId, updated)
        return updated
      } catch (error) {
        if (error instanceof OAuthError && ['invalid_grant', 'invalid_token'].includes(error.code)) {
          this.store.unlink(discordId)
          throw new AppError(401, 'reconnect')
        }
        throw new AppError(502, 'requestFailed')
      }
    })()
    this.refreshing.set(discordId, pending)
    try {
      return await pending
    } finally {
      this.refreshing.delete(discordId)
    }
  }
  async client(discordId: string, scope: string): Promise<BranilistClient> {
    const tokens = await this.freshTokens(discordId)
    if (!tokens.scopes.includes(scope)) throw new AppError(403, 'missingScope')
    return createClient({
      endpoint: this.config.BRANILIST_GRAPHQL_URL,
      accessToken: tokens.access_token,
      timeoutMs: 12000,
      retry: { maxRetries: 1 },
    })
  }
  async profile(discordId: string, username?: string): Promise<ProfileCard> {
    if (this.config.DEMO_MODE)
      return {
        id: '1',
        username: username || 'hanami',
        displayName: 'Hanami',
        avatarUrl: null,
        bio: 'Uma história de cada vez. / One story at a time.',
        createdAt: '2026-01-01T00:00:00Z',
      }
    const client = await this.client(discordId, 'profile:read')
    const fields = {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      createdAt: true,
    } as const
    const profile = username
      ? (await this.withErrors(() => client.query({ user: { __args: { username }, ...fields } }))).user
      : (await this.withErrors(() => client.query({ viewer: { profile: fields } }))).viewer?.profile
    if (!profile) throw new AppError(404, 'notFound')
    return profile
  }
  async library(discordId: string, offset = 0, status?: ListStatus) {
    if (this.config.DEMO_MODE) {
      const entries = this.demoEntries.filter((e) => !status || status === e.status)
      return {
        nodes: entries.slice(offset, offset + 12),
        pageInfo: { limit: 12, offset, hasNextPage: entries.length > offset + 12 },
      }
    }
    const client = await this.client(discordId, 'library:read')
    const result = await this.withErrors(() =>
      client.query({
        viewer: {
          libraryPage: {
            __args: { offset, first: 12, status },
            nodes: { mediaId: true, progress: true, status: true, score: true, media: mediaFields },
            pageInfo: { limit: true, offset: true, hasNextPage: true },
          },
        },
      }),
    )
    if (!result.viewer?.libraryPage) throw new AppError(403, 'missingScope')
    return {
      ...result.viewer.libraryPage,
      nodes: result.viewer.libraryPage.nodes.filter((n) => !n.media?.isAdult),
    }
  }
  async progress(discordId: string, mediaId: string, progress: number, status?: ListStatus) {
    await this.media(mediaId)
    if (this.config.DEMO_MODE) {
      const entry = this.demoEntries.find((e) => e.mediaId === mediaId)
      if (entry) {
        entry.progress = progress
        if (status) entry.status = status
      } else
        this.demoEntries.push({
          mediaId,
          progress,
          status: status ?? 'CURRENT',
          score: null,
          media: await this.media(mediaId),
        })
      return
    }
    const client = await this.client(discordId, 'library:write')
    await this.withErrors(() =>
      client.mutation({
        saveLibraryEntry: {
          __args: { mediaId, input: { progress, ...(status ? { status } : {}) } },
          mediaId: true,
          progress: true,
        },
      }),
    )
  }
  async remove(discordId: string, mediaId: string): Promise<void> {
    if (this.config.DEMO_MODE) {
      this.demoEntries = this.demoEntries.filter((e) => e.mediaId !== mediaId)
      return
    }
    const client = await this.client(discordId, 'library:write')
    await this.withErrors(() =>
      client.mutation({ removeLibraryEntry: { __args: { mediaId }, removed: true } }),
    )
  }
  async favourites(discordId: string) {
    if (this.config.DEMO_MODE) return demoMedia.slice(0, 3)
    const client = await this.client(discordId, 'favourites:read')
    const result = await this.withErrors(() =>
      client.query({
        viewer: { favourites: { __args: { type: 'MEDIA', first: 10 }, nodes: { media: mediaFields } } },
      }),
    )
    return (
      result.viewer?.favourites?.nodes.flatMap((f) => (f.media && !f.media.isAdult ? [f.media] : [])) ?? []
    )
  }
  async collections(discordId: string) {
    if (this.config.DEMO_MODE)
      return [{ id: '1', name: 'Para uma tarde tranquila', itemCount: 3, visibility: 'PRIVATE' }]
    const client = await this.client(discordId, 'collections:read')
    const result = await this.withErrors(() =>
      client.query({
        viewer: {
          collections: {
            __args: { first: 10 },
            nodes: { id: true, name: true, itemCount: true, visibility: true },
          },
        },
      }),
    )
    return result.viewer?.collections?.nodes ?? []
  }
  async unlink(discordId: string): Promise<void> {
    const pending = this.refreshing.get(discordId)
    if (pending) await pending.catch(() => undefined)
    const tokens = this.store.account(discordId)
    this.store.unlink(discordId)
    if (tokens && this.oauth) {
      await Promise.allSettled([
        this.oauth.revokeToken(tokens.access_token),
        this.oauth.revokeToken(tokens.refresh_token),
      ])
    }
  }
}
