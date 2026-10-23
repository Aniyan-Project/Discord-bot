import { z } from 'zod'
import type { Config } from './config.js'
import type { Store, Session, DiscordTokens } from './store.js'
import type { GuildSummary, UserInfo } from '../shared/domain.js'
import { AppError, canManageGuild } from './security.js'
const discordTokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
})
const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  global_name: z.string().nullable().optional(),
  avatar: z.string().nullable(),
})
const guildSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  owner: z.boolean().optional(),
  permissions: z.string(),
})
export class DiscordAuth {
  private readonly refreshing = new Map<string, Promise<DiscordTokens>>()
  constructor(
    private readonly config: Config,
    private readonly store: Store,
  ) {}
  authorizeURL(state: string): string {
    const url = new URL('https://discord.com/oauth2/authorize')
    url.search = new URLSearchParams({
      client_id: this.config.DISCORD_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${this.config.APP_URL}/auth/discord/callback`,
      scope: 'identify guilds',
      state,
      prompt: 'consent',
    }).toString()
    return url.href
  }
  inviteURL(guildId?: string): string | null {
    if (!this.config.DISCORD_CLIENT_ID) return null
    const url = new URL('https://discord.com/oauth2/authorize')
    url.search = new URLSearchParams({
      client_id: this.config.DISCORD_CLIENT_ID,
      scope: 'bot applications.commands',
      permissions: '67193856',
      ...(guildId ? { guild_id: guildId, disable_guild_select: 'true' } : {}),
    }).toString()
    return url.href
  }
  private async token(values: Record<string, string>): Promise<DiscordTokens> {
    const response = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.DISCORD_CLIENT_ID,
        client_secret: this.config.DISCORD_CLIENT_SECRET,
        ...values,
      }),
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok)
      throw new AppError(
        response.status === 400 || response.status === 401 ? 401 : 502,
        response.status === 400 || response.status === 401 ? 'unauthorized' : 'requestFailed',
      )
    const token = discordTokenSchema.parse(await response.json())
    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    }
  }
  async exchangeCode(code: string): Promise<DiscordTokens> {
    return this.token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${this.config.APP_URL}/auth/discord/callback`,
    })
  }
  private async currentToken(session: Session): Promise<string> {
    if (session.discord.expiresAt > Date.now() + 60000) return session.discord.access_token
    let refreshing = this.refreshing.get(session.id)
    if (!refreshing) {
      refreshing = this.token({ grant_type: 'refresh_token', refresh_token: session.discord.refresh_token })
      this.refreshing.set(session.id, refreshing)
    }
    try {
      const tokens = await refreshing
      // A logout while the provider responds must not recreate a deleted session.
      if (!this.store.session(session.id)) throw new AppError(401, 'unauthorized')
      session.discord = tokens
      this.store.putSession(session)
      return tokens.access_token
    } catch (error) {
      if (error instanceof AppError && error.status === 401) this.store.deleteSession(session.id)
      throw error
    } finally {
      this.refreshing.delete(session.id)
    }
  }
  private async get(path: string, accessToken: string): Promise<unknown> {
    const response = await fetch(`https://discord.com/api/v10${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(12000),
      redirect: 'error',
    })
    if (!response.ok)
      throw new AppError(
        response.status === 401 ? 401 : response.status === 429 ? 429 : 502,
        response.status === 401 ? 'unauthorized' : response.status === 429 ? 'rateLimited' : 'requestFailed',
      )
    return response.json()
  }
  async user(accessToken: string): Promise<UserInfo> {
    const user = userSchema.parse(await this.get('/users/@me', accessToken))
    return {
      id: user.id,
      username: user.global_name || user.username,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
        : null,
    }
  }
  async guilds(session: Session): Promise<GuildSummary[]> {
    const guilds = z
      .array(guildSchema)
      .parse(await this.get('/users/@me/guilds?limit=200', await this.currentToken(session)))
    return guilds.filter(canManageGuild).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null,
      installed: false,
    }))
  }
  async requireGuild(session: Session, id: string): Promise<GuildSummary> {
    const guild = (await this.guilds(session)).find((g) => g.id === id)
    if (!guild) throw new AppError(403, 'forbidden')
    return guild
  }
}
