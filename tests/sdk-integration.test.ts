import test from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig } from '../server/config.js'
import { Store, type AccountTokens } from '../server/store.js'
import { BranilistService } from '../server/branilist.js'
import { AppError } from '../server/security.js'
import { demoMedia } from '../shared/example-media.js'
const key = '33'.repeat(32)

test('detail queries fetch genres and filter unavailable or adult related works', async () => {
  const original = globalThis.fetch
  let query = ''
  globalThis.fetch = async (_url, init) => {
    query = JSON.parse(init!.body as string).query
    return new Response(
      JSON.stringify({
        data: {
          media: {
            ...demoMedia[0],
            genres: { nodes: [{ name: 'Fantasia' }] },
            relations: {
              nodes: [
                { type: 'PREQUEL', media: { ...demoMedia[0], id: '1' } },
                { type: 'SEQUEL', media: { ...demoMedia[0], id: '2', isAdult: true } },
                { type: 'OTHER', media: null },
              ],
              pageInfo: { hasNextPage: false },
            },
          },
        },
      }),
    )
  }
  const store = new Store(':memory:', key)
  try {
    const result = await new BranilistService(cfg(), store).mediaDetail('79')
    assert.deepEqual(result.genres, ['Fantasia'])
    assert.deepEqual(
      result.relations?.map((r) => r.media.id),
      ['1'],
    )
    assert.match(query, /genres/)
    assert.match(query, /relations/)
    assert.match(query, /isAdult/)
  } finally {
    globalThis.fetch = original
    store.close()
  }
})
function tokens(scopes = ['profile:read']): AccountTokens {
  return {
    access_token: 'expired',
    refresh_token: 'old-refresh',
    expiresAt: Date.now() - 1,
    scopes,
    profile: { username: 'member', displayName: 'Member', avatarUrl: null, scopes },
  }
}
function cfg() {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_PATH: ':memory:',
    ENCRYPTION_KEY: key,
    DISCORD_TOKEN: 'test',
    DISCORD_CLIENT_ID: '1100000000000000000',
    DISCORD_CLIENT_SECRET: 'test',
    BRANILIST_CLIENT_ID: 'test',
    BRANILIST_GRAPHQL_URL: 'https://branilist.example/api/graphql',
    BRANILIST_ISSUER: 'https://branilist.example',
  })
}
test('published SDK sends typed catalog queries and filters adult media', async () => {
  const original = globalThis.fetch
  const calls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response(
      JSON.stringify({
        data: {
          mediaPage: {
            nodes: [
              { id: '1', isAdult: true },
              { id: '2', isAdult: false },
            ],
            pageInfo: { limit: 12, offset: 0, hasNextPage: false },
          },
        },
      }),
    )
  }
  const store = new Store(':memory:', key)
  try {
    const api = new BranilistService(cfg(), store)
    const result = await api.search('test', 'ANIME')
    assert.deepEqual(
      result.nodes.map((n) => n.id),
      ['2'],
    )
    const sent = JSON.parse(calls[0]!.init!.body as string)
    assert.match(sent.query, /mediaPage/)
    assert.ok(Object.values(sent.variables).includes('test'))
    assert.equal((calls[0]!.init!.headers as Record<string, string>).authorization, undefined)
    await api.search('test', 'ANIME')
    assert.equal(calls.length, 1)
  } finally {
    globalThis.fetch = original
    store.close()
  }
})
test('concurrent account requests share one refresh and persist rotated tokens', async () => {
  const original = globalThis.fetch
  let refreshes = 0
  globalThis.fetch = async () => {
    refreshes++
    await new Promise((r) => setTimeout(r, 20))
    return new Response(
      JSON.stringify({
        access_token: 'rotated',
        refresh_token: 'new-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'profile:read',
      }),
    )
  }
  const store = new Store(':memory:', key)
  store.putAccount('user', tokens())
  try {
    const api = new BranilistService(cfg(), store)
    await Promise.all([
      api.client('user', 'profile:read'),
      api.client('user', 'profile:read'),
      api.client('user', 'profile:read'),
    ])
    assert.equal(refreshes, 1)
    assert.equal(store.account('user')?.refresh_token, 'new-refresh')
  } finally {
    globalThis.fetch = original
    store.close()
  }
})
test('transient refresh failures preserve the account; invalid grants remove stale credentials', async () => {
  const original = globalThis.fetch
  const store = new Store(':memory:', key)
  try {
    for (const [status, code] of [
      [503, 'temporarily_unavailable'],
      [400, 'invalid_grant'],
    ] as const) {
      globalThis.fetch = async () => new Response(JSON.stringify({ error: code }), { status })
      store.putAccount('user', tokens())
      const api = new BranilistService(cfg(), store)
      await assert.rejects(api.client('user', 'profile:read'), AppError)
      assert.equal(store.account('user') === null, code === 'invalid_grant')
    }
  } finally {
    globalThis.fetch = original
    store.close()
  }
})
test('private reads never fall back to an operator API key and reject missing scopes', async () => {
  const store = new Store(':memory:', key)
  try {
    const api = new BranilistService(cfg(), store)
    await assert.rejects(
      api.profile('unlinked', 'someone'),
      (e) => e instanceof AppError && e.code === 'linkRequired',
    )
    store.putAccount('user', { ...tokens(), expiresAt: Date.now() + 3600000 })
    await assert.rejects(
      api.client('user', 'library:write'),
      (e) => e instanceof AppError && e.code === 'missingScope',
    )
  } finally {
    store.close()
  }
})
