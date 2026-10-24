import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../server/app.js'
import { loadConfig } from '../server/config.js'
import { Store, type Session } from '../server/store.js'
import { DiscordAuth } from '../server/discord-auth.js'
import { BotRuntime } from '../server/bot/runtime.js'
import { BranilistService } from '../server/branilist.js'
import { AppError } from '../server/security.js'
import { defaultSettings } from '../shared/domain.js'
const key = '22'.repeat(32),
  guildId = '1100000000000000001',
  otherGuild = '1100000000000000009'
function cfg(demo = true) {
  return loadConfig({
    NODE_ENV: 'test',
    DEMO_MODE: String(demo),
    DATABASE_PATH: ':memory:',
    ENCRYPTION_KEY: key,
    APP_URL: 'http://localhost:5173',
    DISCORD_TOKEN: 'test-token',
    DISCORD_CLIENT_ID: '1100000000000000000',
    DISCORD_CLIENT_SECRET: 'test-secret',
    BRANILIST_CLIENT_ID: 'test-branilist-app',
  })
}
class FakeDiscord extends DiscordAuth {
  override async guilds(_session: Session) {
    return [{ id: guildId, name: 'Authorized server', icon: null, installed: true }]
  }
  override async exchangeCode(_code: string) {
    return { access_token: 'secret-access', refresh_token: 'secret-refresh', expiresAt: Date.now() + 3600000 }
  }
  override async user(_access: string) {
    return { id: '1000000000000000001', username: 'member', avatar: null }
  }
}
class FakeBot extends BotRuntime {
  override installed(id: string) {
    return id === guildId
  }
  override async channels(_id: string) {
    return [{ id: '1200000000000000001', name: 'allowed' }]
  }
  override async nickname(_id: string, _name: string) {}
}
async function liveTestApp() {
  const config = cfg(false)
  const store = new Store(':memory:', key)
  const api = new BranilistService(config, store)
  const discord = new FakeDiscord(config, store)
  const bot = new FakeBot(config, store, api)
  const result = await createApp(config, { store, api, discord, bot })
  const session = store.createSession(
    { id: '1000000000000000001', username: 'member', avatar: null },
    { access_token: 'access', refresh_token: 'refresh', expiresAt: Date.now() + 3600000 },
  )
  return { ...result, session }
}
function sessionHeaders(session: Session) {
  return {
    cookie: `branilist.sid=${session.id}`,
    origin: 'http://localhost:5173',
    'x-csrf-token': session.csrfToken,
  }
}

test('a pending Discord refresh cannot restore a session after logout', async () => {
  const store = new Store(':memory:', key)
  const original = globalThis.fetch
  let respond!: (response: Response) => void
  globalThis.fetch = () =>
    new Promise<Response>((resolve) => {
      respond = resolve
    })
  try {
    const session = store.createSession(
      { id: '1000000000000000001', username: 'member', avatar: null },
      { access_token: 'expired', refresh_token: 'refresh', expiresAt: Date.now() - 1 },
    )
    const pending = new DiscordAuth(cfg(false), store).guilds(session)
    store.deleteSession(session.id)
    respond(new Response(JSON.stringify({ access_token: 'new', refresh_token: 'rotated', expires_in: 3600 })))
    await assert.rejects(pending, AppError)
    assert.equal(store.session(session.id), null)
  } finally {
    globalThis.fetch = original
    store.close()
  }
})

test('anonymous dashboard access is rejected and the public session view contains no secrets', async () => {
  const { app } = await liveTestApp()
  try {
    for (const url of ['/api/guilds', `/api/guilds/${guildId}`, '/api/account/library'])
      assert.equal((await app.inject({ url })).statusCode, 401)
    const result = await app.inject({ url: '/api/session' })
    assert.equal(result.json().user, null)
    assert.ok(!result.body.includes('test-secret'))
    assert.equal(result.headers['cache-control'], 'no-store')
  } finally {
    await app.close()
  }
})
test('guild authorization is rechecked and cross-server IDOR requests fail closed', async () => {
  const { app, session } = await liveTestApp()
  const headers = sessionHeaders(session)
  try {
    assert.equal((await app.inject({ url: `/api/guilds/${guildId}`, headers })).statusCode, 200)
    assert.equal((await app.inject({ url: `/api/guilds/${otherGuild}`, headers })).statusCode, 403)
    assert.equal(
      (
        await app.inject({
          method: 'PUT',
          url: `/api/guilds/${otherGuild}/settings`,
          headers,
          payload: { settings: defaultSettings, revision: 0 },
        })
      ).statusCode,
      403,
    )
    assert.equal((await app.inject({ url: `/api/guilds/${otherGuild}/activity`, headers })).statusCode, 403)
  } finally {
    await app.close()
  }
})
test('all authenticated mutations enforce both origin and the session CSRF token', async () => {
  const { app, session } = await liveTestApp()
  const headers = sessionHeaders(session)
  try {
    for (const [method, url, payload] of [
      ['PUT', `/api/guilds/${guildId}/settings`, { settings: defaultSettings, revision: 0 }],
      ['PUT', '/api/account/progress', { mediaId: '79', progress: 2 }],
      ['DELETE', '/api/account/library/79', undefined],
      ['POST', '/api/account/unlink', undefined],
      ['POST', '/api/logout', undefined],
    ] as const) {
      assert.equal(
        (
          await app.inject({
            method,
            url,
            headers: { cookie: headers.cookie, origin: headers.origin },
            payload,
          })
        ).statusCode,
        403,
        url,
      )
      assert.equal(
        (
          await app.inject({
            method,
            url,
            headers: { ...headers, origin: 'https://attacker.example' },
            payload,
          })
        ).statusCode,
        403,
        url,
      )
    }
  } finally {
    await app.close()
  }
})
test('settings writes validate channels, reject stale revisions and do not accept arbitrary keys', async () => {
  const { app, session } = await liveTestApp()
  const headers = sessionHeaders(session)
  try {
    const url = `/api/guilds/${guildId}/settings`
    assert.equal(
      (
        await app.inject({
          method: 'PUT',
          url,
          headers,
          payload: {
            settings: { ...defaultSettings, allowedChannelIds: ['1200000000000000099'] },
            revision: 0,
          },
        })
      ).statusCode,
      400,
    )
    assert.equal(
      (
        await app.inject({
          method: 'PUT',
          url,
          headers,
          payload: { settings: { ...defaultSettings, isAdmin: true }, revision: 0 },
        })
      ).statusCode,
      400,
    )
    const result = await app.inject({
      method: 'PUT',
      url,
      headers,
      payload: { settings: { ...defaultSettings, prefix: '?' }, revision: 0 },
    })
    assert.equal(result.statusCode, 200)
    assert.equal(result.json().revision, 1)
    assert.equal(
      (await app.inject({ method: 'PUT', url, headers, payload: { settings: defaultSettings, revision: 0 } }))
        .statusCode,
      409,
    )
  } finally {
    await app.close()
  }
})
test('Discord OAuth state is browser-bound, single-use and rotates the login session', async () => {
  const { app, session, store } = await liveTestApp()
  try {
    const returnTo = '/transcripts/1100000000000000001/00000000-0000-4000-8000-000000000000'
    const start = await app.inject({ url: '/auth/discord?returnTo=' + encodeURIComponent(returnTo) })
    assert.equal(start.statusCode, 302)
    const state = new URL(start.headers.location as string).searchParams.get('state')!
    const stateCookie = `branilist.discord-state=${state}`
    const invalid = await app.inject({
      url: `/auth/discord/callback?code=fake&state=${state}`,
      headers: { cookie: 'branilist.discord-state=wrong' },
    })
    assert.equal(invalid.headers.location, '/?auth=failed')
    const valid = await app.inject({
      url: `/auth/discord/callback?code=fake&state=${state}`,
      headers: { cookie: `${stateCookie}; branilist.sid=${session.id}` },
    })
    assert.equal(valid.headers.location, returnTo)
    assert.equal(store.session(session.id), null)
    const cookies = Array.isArray(valid.headers['set-cookie'])
      ? valid.headers['set-cookie']
      : [String(valid.headers['set-cookie'])]
    const loginCookie = cookies.find((v) => v.startsWith('branilist.sid='))!
    assert.match(loginCookie, /HttpOnly/i)
    assert.match(loginCookie, /SameSite=Lax/i)
    const replay = await app.inject({
      url: `/auth/discord/callback?code=fake&state=${state}`,
      headers: { cookie: stateCookie },
    })
    assert.equal(replay.headers.location, '/?auth=failed')
  } finally {
    await app.close()
  }
})
test('Branilist account linking uses PKCE and binds authorization to the logged-in Discord session', async () => {
  const { app, session, store } = await liveTestApp()
  try {
    const start = await app.inject({
      url: '/auth/branilist',
      headers: { cookie: `branilist.sid=${session.id}` },
    })
    const url = new URL(start.headers.location as string)
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(url.searchParams.get('code_verifier'), null)
    assert.match(url.searchParams.get('scope')!, /library:write/)
    const state = url.searchParams.get('state')!
    const otherSession = store.createSession(
      { id: 'other', username: 'other', avatar: null },
      { access_token: 'other', refresh_token: 'other', expiresAt: Date.now() + 1000 },
    )
    const mismatch = await app.inject({
      url: `/auth/branilist/callback?code=fake&state=${state}`,
      headers: { cookie: `branilist.sid=${otherSession.id}; branilist.account-state=${state}` },
    })
    assert.equal(mismatch.headers.location, '/dashboard/account?error=oauthFailed')
    assert.equal(store.account(otherSession.user.id), null)
  } finally {
    await app.close()
  }
})
test('demo writes persist, are clearly labelled and never expose placeholder tokens', async () => {
  const { app } = await createApp(cfg())
  try {
    const session = (await app.inject({ url: '/api/session' })).json()
    assert.equal(session.demo, true)
    assert.ok(!JSON.stringify(session).includes('demo-only'))
    const headers = { origin: 'http://localhost:5173', 'x-csrf-token': session.csrfToken }
    const update = await app.inject({
      method: 'PUT',
      url: `/api/guilds/${guildId}/settings`,
      headers,
      payload: { settings: { ...defaultSettings, prefix: '$', locale: 'es' }, revision: 0 },
    })
    assert.equal(update.statusCode, 200)
    const settings = (await app.inject({ url: `/api/guilds/${guildId}` })).json()
    assert.equal(settings.settings.prefix, '$')
    assert.equal(settings.settings.locale, 'es')
    const library = (await app.inject({ url: '/api/account/library' })).json()
    const mediaId = library.nodes[0].mediaId
    assert.equal(
      (
        await app.inject({
          method: 'PUT',
          url: '/api/account/progress',
          headers,
          payload: { mediaId, progress: 3 },
        })
      ).statusCode,
      200,
    )
    assert.equal((await app.inject({ url: '/api/account/library' })).json().nodes[0].progress, 3)
    assert.equal(
      (await app.inject({ method: 'DELETE', url: `/api/account/library/${mediaId}`, headers })).statusCode,
      200,
    )
    assert.ok(
      !(await app.inject({ url: '/api/account/library' }))
        .json()
        .nodes.some((n: { mediaId: string }) => n.mediaId === mediaId),
    )
  } finally {
    await app.close()
  }
})
test('oversized input and invalid pagination are rejected before reaching the SDK', async () => {
  const { app } = await createApp(cfg())
  try {
    assert.equal((await app.inject({ url: '/api/catalog?offset=10001' })).statusCode, 400)
    assert.equal((await app.inject({ url: '/api/catalog?type=INVALID' })).statusCode, 400)
    assert.equal(
      (
        await app.inject({
          method: 'PUT',
          url: '/api/account/progress',
          headers: { 'content-type': 'application/json' },
          payload: 'x'.repeat(40000),
        })
      ).statusCode,
      413,
    )
  } finally {
    await app.close()
  }
})
test('invite requests no Administrator permission', async () => {
  const { app, discord } = await liveTestApp()
  try {
    const url = new URL(discord.inviteURL()!)
    assert.equal(BigInt(url.searchParams.get('permissions')!) & 8n, 0n)
    assert.equal(url.searchParams.get('scope'), 'bot applications.commands')
  } finally {
    await app.close()
  }
})

test('Discord OAuth ignores return destinations outside transcript pages', async () => {
  const { app } = await liveTestApp()
  try {
    for (const returnTo of [
      'https://evil.example',
      '//evil.example',
      '/dashboard?next=https://evil.example',
    ]) {
      const start = await app.inject({ url: '/auth/discord?returnTo=' + encodeURIComponent(returnTo) })
      const state = new URL(start.headers.location as string).searchParams.get('state')!
      const result = await app.inject({
        url: `/auth/discord/callback?code=fake&state=${state}`,
        headers: { cookie: `branilist.discord-state=${state}` },
      })
      assert.equal(result.headers.location, '/dashboard')
    }
  } finally {
    await app.close()
  }
})
