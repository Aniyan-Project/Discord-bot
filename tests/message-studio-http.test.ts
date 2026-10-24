import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../server/app.js'
import { loadConfig } from '../server/config.js'
import { Store, type Session } from '../server/store.js'
import { BotRuntime } from '../server/bot/runtime.js'
import { DiscordAuth } from '../server/discord-auth.js'
import { BranilistService } from '../server/branilist.js'
import { MessageStudio } from '../server/bot/services/message-studio.js'
import { AppError } from '../server/security.js'
import type { StudioDraft } from '../shared/message-studio.js'
const guild = '1100000000000000001',
  key = '33'.repeat(32)
function draft(): StudioDraft {
  return {
    version: 1,
    name: 'Test',
    mode: 'classic',
    channelId: '1200000000000000001',
    sender: { type: 'bot', name: '', avatar: '' },
    mentions: [],
    content: 'Hello {{server}}',
    embeds: [],
    components: [],
  }
}
class FakeDiscord extends DiscordAuth {
  override async guilds(_session: Session) {
    return [{ id: guild, name: 'Club', icon: null, installed: true }]
  }
}
class FakeBot extends BotRuntime {
  override installed(id: string) {
    return id === guild
  }
}
class FakeStudio extends MessageStudio {
  calls = 0
  fail = false
  reject: AppError | null = null
  override async context() {
    return {
      variables: { server: 'Club' },
      channels: [{ id: '1200000000000000001', name: 'anime', webhook: true }],
    }
  }
  override async send() {
    this.calls++
    if (this.reject) throw this.reject
    if (this.fail) throw new AppError(502, 'studioDeliveryUncertain')
    return { id: '1500000000000000001', url: 'https://discord.com/channels/message', demo: false }
  }
}
async function fixture() {
  const config = loadConfig({
    NODE_ENV: 'test',
    DEMO_MODE: 'false',
    DATABASE_PATH: ':memory:',
    ENCRYPTION_KEY: key,
    APP_URL: 'http://localhost:5173',
    DISCORD_TOKEN: 'test-token',
    DISCORD_CLIENT_ID: '1100000000000000000',
    DISCORD_CLIENT_SECRET: 'test-secret',
  })
  const store = new Store(':memory:', key),
    api = new BranilistService(config, store),
    bot = new FakeBot(config, store, api),
    discord = new FakeDiscord(config, store),
    studio = new FakeStudio(bot.client, false)
  const { app } = await createApp(config, { store, api, bot, discord, studio })
  const session = store.createSession(
    { id: '1000000000000000001', username: 'Hanami', avatar: null },
    { access_token: 'private-access', refresh_token: 'private-refresh', expiresAt: Date.now() + 60000 },
  )
  const headers = {
    cookie: `branilist.sid=${session.id}`,
    origin: 'http://localhost:5173',
    'x-csrf-token': session.csrfToken,
  }
  return { app, store, studio, session, headers }
}
test('studio endpoints require login, CSRF and management of the target guild', async () => {
  const { app, studio, headers } = await fixture()
  try {
    assert.equal((await app.inject({ url: `/api/guilds/${guild}/message-studio` })).statusCode, 401)
    assert.equal(
      (await app.inject({ url: `/api/guilds/1100000000000000999/message-studio`, headers })).statusCode,
      403,
    )
    for (const url of [
      `/api/guilds/${guild}/message-studio/send`,
      `/api/guilds/${guild}/message-studio/draft`,
    ]) {
      const result = await app.inject({
        method: url.endsWith('send') ? 'POST' : 'PUT',
        url,
        headers: { cookie: headers.cookie },
        payload: { draft: draft(), requestId: crypto.randomUUID(), revision: 0 },
      })
      assert.equal(result.statusCode, 403)
    }
    assert.equal(studio.calls, 0)
  } finally {
    await app.close()
  }
})
test('drafts persist per server and actor, reject malformed imports and stale saves', async () => {
  const { app, store, session, headers } = await fixture()
  try {
    const url = `/api/guilds/${guild}/message-studio/draft`
    assert.equal(
      (await app.inject({ method: 'PUT', url, headers, payload: { draft: draft(), revision: 0 } }))
        .statusCode,
      200,
    )
    assert.equal(
      (
        await app.inject({
          method: 'PUT',
          url,
          headers,
          payload: { draft: { ...draft(), name: 'overwrite' }, revision: 0 },
        })
      ).statusCode,
      409,
    )
    assert.equal(
      (
        await app.inject({
          method: 'PUT',
          url,
          headers,
          payload: {
            draft: { ...draft(), embeds: [{ author: { name: { malformed: true } } }] },
            revision: 1,
          },
        })
      ).statusCode,
      400,
    )
    const body = (await app.inject({ url: `/api/guilds/${guild}/message-studio`, headers })).json()
    assert.equal(body.draft.name, 'Test')
    assert.equal(body.revision, 1)
    assert.equal(store.studioDraft(guild, 'other-actor').draft, null)
    assert.equal(store.studioDraft('other-guild', session.user.id).draft, null)
    assert.ok(!JSON.stringify(body).includes('private-access'))
  } finally {
    await app.close()
  }
})
test('duplicate concurrent send requests deliver once and cannot reuse a key with changed content', async () => {
  const { app, studio, headers } = await fixture()
  try {
    const payload = { draft: draft(), requestId: crypto.randomUUID() },
      url = `/api/guilds/${guild}/message-studio/send`
    const results = await Promise.all([1, 2].map(() => app.inject({ method: 'POST', url, headers, payload })))
    assert.deepEqual(
      results.map((r) => r.statusCode),
      [200, 200],
    )
    assert.equal(studio.calls, 1)
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url,
          headers,
          payload: { ...payload, draft: { ...draft(), content: 'different' } },
        })
      ).statusCode,
      409,
    )
    assert.equal(studio.calls, 1)
  } finally {
    await app.close()
  }
})
test('uncertain delivery is recorded and replayed without another Discord call', async () => {
  const { app, studio, headers } = await fixture()
  studio.fail = true
  try {
    const payload = { draft: draft(), requestId: crypto.randomUUID() },
      url = `/api/guilds/${guild}/message-studio/send`
    for (let i = 0; i < 2; i++)
      assert.equal(
        (await app.inject({ method: 'POST', url, headers, payload })).json().error,
        'studioDeliveryUncertain',
      )
    assert.equal(studio.calls, 1)
  } finally {
    await app.close()
  }
})
test('a rejected attempt can be retried after permissions are fixed without changing the message', async () => {
  const { app, studio, headers } = await fixture()
  try {
    const payload = { draft: draft(), requestId: crypto.randomUUID() },
      url = `/api/guilds/${guild}/message-studio/send`
    studio.reject = new AppError(403, 'studioWebhookDenied')
    assert.equal((await app.inject({ method: 'POST', url, headers, payload })).statusCode, 403)
    studio.reject = null
    assert.equal((await app.inject({ method: 'POST', url, headers, payload })).statusCode, 200)
    assert.equal(studio.calls, 2)
  } finally {
    await app.close()
  }
})
