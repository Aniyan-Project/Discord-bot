import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import staticFiles from '@fastify/static'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { createClient, createPKCE } from '@aniyan-project/branilist-api'
import type { Config } from './config.js'
import { Store, type Session } from './store.js'
import { BranilistService, accountScopes } from './branilist.js'
import { DiscordAuth } from './discord-auth.js'
import { BotRuntime } from './bot.js'
import { AppError, constantEqual, hashToken, requireOrigin } from './security.js'
import { guildSettingsSchema, type GuildSummary, type SessionView } from '../shared/domain.js'
import { parseStudioDraft } from '../shared/message-studio.js'
import { MessageStudio } from './message-studio.js'
const snowflake = z.string().regex(/^\d{17,20}$/)
const mediaId = z.string().regex(/^[1-9]\d{0,19}$/)
const status = z.enum(['PLANNING', 'CURRENT', 'COMPLETED', 'PAUSED', 'DROPPED'])
const demoGuilds: GuildSummary[] = [
  { id: '1100000000000000001', name: 'Aniyan Project: Hub', icon: null, installed: true, memberCount: 128 },
  { id: '1100000000000000002', name: 'Clube do Próximo Episódio', icon: null, installed: false },
]
interface Dependencies {
  store: Store
  api: BranilistService
  discord: DiscordAuth
  bot: BotRuntime
  studio: MessageStudio
}
export async function createApp(config: Config, overrides: Partial<Dependencies> = {}) {
  const store =
    overrides.store ??
    new Store(config.DATABASE_PATH, config.ENCRYPTION_KEY, {
      prefix: config.DEFAULT_PREFIX,
      locale: config.DEFAULT_LOCALE,
      prefixEnabled: config.ENABLE_MESSAGE_CONTENT,
    })
  const api = overrides.api ?? new BranilistService(config, store)
  const discord = overrides.discord ?? new DiscordAuth(config, store)
  const bot = overrides.bot ?? new BotRuntime(config, store, api)
  const studio = overrides.studio ?? new MessageStudio(bot.client, config.DEMO_MODE)
  const app = Fastify({
    bodyLimit: 32768,
    logger:
      config.NODE_ENV === 'test'
        ? false
        : {
            level: 'info',
            serializers: { req: (req) => ({ method: req.method, url: req.url?.split('?')[0], id: req.id }) },
            redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
          },
    trustProxy: config.TRUST_PROXY
      ? config.TRUST_PROXY.split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : false,
  })
  const secure = config.NODE_ENV === 'production'
  const sessionCookie = secure ? '__Host-branilist.sid' : 'branilist.sid'
  const cookieOptions = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' }
  await app.register(cookie)
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'https:', 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
  })
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ error: 'rateLimited' }),
  })
  let demoSession: Session | null = null
  if (config.DEMO_MODE) {
    demoSession = store.createSession(
      { id: '1000000000000000001', username: 'Hanami', avatar: null },
      { access_token: 'demo-only', refresh_token: 'demo-only', expiresAt: Date.now() + 86400000 },
    )
    store.putAccount(demoSession.user.id, {
      access_token: 'demo-only',
      refresh_token: 'demo-only',
      expiresAt: Date.now() + 86400000,
      scopes: [...accountScopes],
      profile: { username: 'hanami', displayName: 'Hanami', avatarUrl: null, scopes: [...accountScopes] },
    })
    for (const command of ['anime', 'profile', 'manga', 'library', 'anime', 'trending', 'profile'])
      store.event(demoGuilds[0]!.id, command, true)
  }
  function session(request: import('fastify').FastifyRequest): Session {
    const value = config.DEMO_MODE ? demoSession : store.session(request.cookies[sessionCookie])
    if (!value) throw new AppError(401, 'unauthorized')
    return value
  }
  function csrf(request: import('fastify').FastifyRequest): Session {
    requireOrigin(request.headers.origin, config.APP_URL)
    const value = session(request)
    const token = request.headers['x-csrf-token']
    if (typeof token !== 'string' || !constantEqual(token, value.csrfToken))
      throw new AppError(403, 'invalidOrigin')
    return value
  }
  async function requireGuild(request: import('fastify').FastifyRequest, installed = true) {
    const value = session(request)
    const id = snowflake.parse((request.params as { id: string }).id)
    const guild = config.DEMO_MODE
      ? demoGuilds.find((g) => g.id === id)
      : await discord.requireGuild(value, id)
    if (!guild) throw new AppError(403, 'forbidden')
    const isInstalled = config.DEMO_MODE ? guild.installed : bot.installed(id)
    if (installed && !isInstalled) throw new AppError(409, 'notInstalled')
    return { session: value, guild: { ...guild, installed: isInstalled }, id }
  }
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/api') || request.url.startsWith('/auth'))
      reply.header('cache-control', 'no-store')
    return payload
  })
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'invalidInput' })
    if (error instanceof AppError) return reply.code(error.status).send({ error: error.code })
    if (error instanceof Error && error.message === 'revisionConflict')
      return reply.code(409).send({ error: 'revisionConflict' })
    const statusCode =
      error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 500
    if (statusCode === 429) return reply.code(429).send({ error: 'rateLimited' })
    if (statusCode >= 400 && statusCode < 500) return reply.code(statusCode).send({ error: 'invalidInput' })
    app.log.error({ code: 'internal_error' }, 'Request failed')
    return reply.code(500).send({ error: 'requestFailed' })
  })
  app.get('/api/health', async () => ({ ok: true, bot: bot.status().online, demo: config.DEMO_MODE }))
  app.get('/api/session', async (request) => {
    const value = config.DEMO_MODE ? demoSession : store.session(request.cookies[sessionCookie])
    const linked = value ? (store.account(value.user.id)?.profile ?? null) : null
    const view: SessionView = {
      user: value?.user ?? null,
      csrfToken: value?.csrfToken ?? null,
      linked,
      demo: config.DEMO_MODE,
      configured: { discord: !!config.DISCORD_CLIENT_ID, branilist: !!api.oauth, catalog: true },
      inviteUrl: discord.inviteURL(),
      supportUrl: config.SUPPORT_URL,
    }
    return view
  })
  app.get('/api/catalog', { config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (request) => {
    const query = z
      .object({
        q: z.string().max(150).default(''),
        type: z.enum(['ANIME', 'MANGA']).optional(),
        offset: z.coerce.number().int().min(0).max(10000).default(0),
      })
      .parse(request.query)
    return api.search(query.q, query.type, query.offset)
  })
  app.get('/api/media/:id', async (request) => {
    const id = mediaId.parse((request.params as { id: string }).id)
    const provider = z
      .enum(['branilist', 'mal', 'anilist'])
      .parse((request.query as { provider?: string }).provider ?? 'branilist')
    return api.media(id, provider)
  })
  app.get('/api/trending', async (request) =>
    api.trending(z.enum(['ANIME', 'MANGA']).parse((request.query as { type?: string }).type ?? 'ANIME')),
  )
  app.get('/api/guilds', async (request) => {
    const value = session(request)
    return config.DEMO_MODE
      ? demoGuilds
      : (await discord.guilds(value)).map((g) => ({ ...g, installed: bot.installed(g.id) }))
  })
  app.get('/api/guilds/:id', async (request) => {
    const { guild, id } = await requireGuild(request, false)
    return {
      guild,
      ...store.settings(id),
      stats: store.stats(id),
      bot: bot.status(),
      channels: guild.installed ? await bot.channels(id) : [],
      inviteUrl: discord.inviteURL(id),
      prefixAvailable: config.ENABLE_MESSAGE_CONTENT,
    }
  })
  app.put('/api/guilds/:id/settings', async (request) => {
    csrf(request)
    const { id, session: actor } = await requireGuild(request)
    const body = z
      .object({ settings: guildSettingsSchema, revision: z.number().int().min(0) })
      .strict()
      .parse(request.body)
    if (!config.ENABLE_MESSAGE_CONTENT && body.settings.prefixEnabled)
      throw new AppError(400, 'messageIntentDisabled')
    return store.withGuildLock(id, async () => {
      const before = store.settings(id)
      if (before.revision !== body.revision) throw new AppError(409, 'revisionConflict')
      const channelIds = new Set((await bot.channels(id)).map((c) => c.id))
      if (body.settings.allowedChannelIds.some((id) => !channelIds.has(id)))
        throw new AppError(400, 'invalidInput')
      if (before.settings.nickname !== body.settings.nickname) await bot.nickname(id, body.settings.nickname)
      return store.saveSettings(id, body.settings, body.revision, actor.user.id)
    })
  })
  app.get('/api/guilds/:id/activity', async (request) => {
    const { id } = await requireGuild(request)
    return store.events(id)
  })
  app.get('/api/guilds/:id/message-studio', async (request) => {
    const { id, session: actor } = await requireGuild(request)
    return {
      ...(await studio.context(id, actor.user, store.settings(id).settings.locale)),
      ...store.studioDraft(id, actor.user.id),
    }
  })
  app.put('/api/guilds/:id/message-studio/draft', { bodyLimit: 262144 }, async (request) => {
    csrf(request)
    const { id, session: actor } = await requireGuild(request)
    const body = z
      .object({ draft: z.unknown(), revision: z.number().int().min(0) })
      .strict()
      .parse(request.body)
    let draft
    try {
      draft = parseStudioDraft(body.draft)
    } catch {
      throw new AppError(400, 'studioInvalidMessage')
    }
    return store.withGuildLock(id, async () => store.saveStudioDraft(id, actor.user.id, draft, body.revision))
  })
  app.post(
    '/api/guilds/:id/message-studio/send',
    { bodyLimit: 262144, config: { rateLimit: { max: 6, timeWindow: '1 minute' } } },
    async (request) => {
      csrf(request)
      const { id, session: actor } = await requireGuild(request)
      const body = z.object({ draft: z.unknown(), requestId: z.uuid() }).strict().parse(request.body)
      let draft
      try {
        draft = parseStudioDraft(body.draft)
      } catch {
        throw new AppError(400, 'studioInvalidMessage')
      }
      return store.withGuildLock(id, async () => {
        const fingerprint = hashToken(JSON.stringify(draft))
        const before = store.studioDelivery(id, body.requestId)
        if (before) {
          if (before.actor_id !== actor.user.id || before.fingerprint !== fingerprint)
            throw new AppError(409, 'revisionConflict')
          if (!before.result) throw new AppError(409, 'studioDeliveryUncertain')
          const result = JSON.parse(before.result) as { error?: string; status?: number }
          if (result.error) throw new AppError(result.status ?? 502, result.error)
          return result
        }
        store.beginStudioDelivery(id, body.requestId, actor.user.id, fingerprint)
        try {
          const result = await studio.send(
            id,
            actor.user,
            store.settings(id).settings.locale,
            draft,
            body.requestId,
          )
          store.finishStudioDelivery(id, body.requestId, result)
          store.event(id, 'message-studio', true)
          return result
        } catch (error) {
          if (error instanceof AppError && error.status < 500 && error.code !== 'studioDeliveryUncertain') {
            store.cancelStudioDelivery(id, body.requestId)
          } else
            store.finishStudioDelivery(id, body.requestId, {
              error: error instanceof AppError ? error.code : 'studioDeliveryUncertain',
              status: error instanceof AppError ? error.status : 502,
            })
          store.event(id, 'message-studio', false)
          throw error
        }
      })
    },
  )
  app.get('/api/account/profile', async (request) => {
    const value = session(request)
    const username = z
      .string()
      .max(64)
      .optional()
      .parse((request.query as { username?: string }).username)
    return api.profile(value.user.id, username)
  })
  app.get('/api/account/library', async (request) => {
    const value = session(request)
    const query = z
      .object({ offset: z.coerce.number().int().min(0).max(10000).default(0), status: status.optional() })
      .parse(request.query)
    return api.library(value.user.id, query.offset, query.status)
  })
  app.get('/api/account/favourites', async (request) => api.favourites(session(request).user.id))
  app.get('/api/account/collections', async (request) => api.collections(session(request).user.id))
  app.put('/api/account/progress', async (request) => {
    const value = csrf(request)
    const body = z
      .object({ mediaId, progress: z.number().int().min(0).max(100000), status: status.optional() })
      .strict()
      .parse(request.body)
    await api.progress(value.user.id, body.mediaId, body.progress, body.status)
    return { ok: true }
  })
  app.delete('/api/account/library/:id', async (request) => {
    const value = csrf(request)
    const id = mediaId.parse((request.params as { id: string }).id)
    await api.remove(value.user.id, id)
    return { ok: true }
  })
  app.post('/api/account/unlink', async (request) => {
    const value = csrf(request)
    await api.unlink(value.user.id)
    return { ok: true }
  })
  app.post('/api/logout', async (request, reply) => {
    const value = csrf(request)
    if (!config.DEMO_MODE) store.deleteSession(value.id)
    reply.clearCookie(sessionCookie, cookieOptions)
    return { ok: true }
  })
  app.get(
    '/auth/discord',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (_request, reply) => {
      if (config.DEMO_MODE) return reply.redirect('/dashboard')
      if (!config.DISCORD_CLIENT_ID) throw new AppError(503, 'oauthUnavailable')
      const state = store.createState('discord', {})
      reply.setCookie('branilist.discord-state', state, {
        ...cookieOptions,
        path: '/auth/discord',
        maxAge: 600,
      })
      return reply.redirect(discord.authorizeURL(state))
    },
  )
  app.get('/auth/discord/callback', async (request, reply) => {
    const query = z
      .object({
        code: z.string().max(2000).optional(),
        state: z.string().max(200).optional(),
        error: z.string().optional(),
      })
      .parse(request.query)
    const browserState = request.cookies['branilist.discord-state']
    reply.clearCookie('branilist.discord-state', { ...cookieOptions, path: '/auth/discord' })
    try {
      if (
        !query.state ||
        !browserState ||
        !constantEqual(query.state, browserState) ||
        !store.takeState(query.state, 'discord') ||
        query.error ||
        !query.code
      )
        throw new AppError(400, 'oauthFailed')
      const tokens = await discord.exchangeCode(query.code)
      const user = await discord.user(tokens.access_token)
      const old = request.cookies[sessionCookie]
      if (old) store.deleteSession(old)
      const value = store.createSession(user, tokens)
      reply.setCookie(sessionCookie, value.id, { ...cookieOptions, maxAge: 7 * 86400 })
      return reply.redirect('/dashboard')
    } catch {
      return reply.redirect('/?auth=failed')
    }
  })
  app.get('/auth/branilist', async (request, reply) => {
    const value = session(request)
    if (config.DEMO_MODE) return reply.redirect('/dashboard/account')
    if (!api.oauth) throw new AppError(503, 'oauthUnavailable')
    const pkce = await createPKCE()
    const state = store.createState('branilist', {
      session: hashToken(value.id),
      discordId: value.user.id,
      verifier: pkce.verifier,
    })
    reply.setCookie('branilist.account-state', state, {
      ...cookieOptions,
      path: '/auth/branilist',
      maxAge: 600,
    })
    return reply.redirect(api.oauth.authorizationURL({ challenge: pkce.challenge, state }, accountScopes))
  })
  app.get('/auth/branilist/callback', async (request, reply) => {
    const query = z
      .object({
        code: z.string().max(2000).optional(),
        state: z.string().max(200).optional(),
        error: z.string().optional(),
      })
      .parse(request.query)
    const browserState = request.cookies['branilist.account-state']
    reply.clearCookie('branilist.account-state', { ...cookieOptions, path: '/auth/branilist' })
    try {
      const value = session(request)
      if (
        !api.oauth ||
        !query.state ||
        !browserState ||
        !constantEqual(query.state, browserState) ||
        query.error ||
        !query.code
      )
        throw new AppError(400, 'oauthFailed')
      const state = store.takeState<{ session: string; discordId: string; verifier: string }>(
        query.state,
        'branilist',
      )
      if (!state || state.discordId !== value.user.id || state.session !== hashToken(value.id))
        throw new AppError(400, 'oauthFailed')
      const tokens = await api.oauth.exchangeCode(query.code, state.verifier)
      const result = await createClient({
        endpoint: config.BRANILIST_GRAPHQL_URL,
        accessToken: tokens.access_token,
      }).query({ viewer: { profile: { username: true, displayName: true, avatarUrl: true } } })
      if (!result.viewer?.profile) throw new AppError(403, 'missingScope')
      const scopes = tokens.scope.split(/\s+/).filter(Boolean)
      store.putAccount(value.user.id, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        scopes,
        profile: { ...result.viewer.profile, scopes },
      })
      return reply.redirect('/dashboard/account?linked=1')
    } catch {
      return reply.redirect('/dashboard/account?error=oauthFailed')
    }
  })
  const webRoot = fileURLToPath(new URL('../web/', import.meta.url))
  const productionWeb = fileURLToPath(new URL('../web/index.html', import.meta.url))
  if (config.NODE_ENV === 'production' && existsSync(productionWeb)) {
    await app.register(staticFiles, { root: webRoot, prefix: '/', index: ['index.html'] })
    app.setNotFoundHandler((request, reply) =>
      request.url.startsWith('/api') || request.url.startsWith('/auth') || request.url.startsWith('/assets/')
        ? reply.code(404).send({ error: 'notFound' })
        : reply.header('cache-control', 'no-cache').sendFile('index.html'),
    )
  }
  const cleanup = setInterval(() => store.cleanup(), 60 * 60000)
  cleanup.unref()
  app.addHook('onClose', async () => {
    clearInterval(cleanup)
    studio.close()
    await bot.close()
    store.close()
  })
  return { app, store, bot, api, discord }
}
