import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../dist/server/app.js'
import { loadConfig } from '../dist/server/config.js'
test('production build serves the compiled SPA, assets and secure cookies without leaking server files', async () => {
  const config = loadConfig({
    NODE_ENV: 'production',
    APP_URL: 'https://bot.example',
    DATABASE_PATH: ':memory:',
    ENCRYPTION_KEY: '44'.repeat(32),
    DISCORD_TOKEN: 'test-only',
    DISCORD_CLIENT_ID: '1100000000000000000',
    DISCORD_CLIENT_SECRET: 'test-only',
  })
  const { app } = await createApp(config)
  try {
    const page = await app.inject({ url: '/dashboard/account' })
    assert.equal(page.statusCode, 200)
    assert.match(page.headers['content-type'], /text\/html/)
    assert.doesNotMatch(page.body, /main\.tsx/)
    const script = page.body.match(/src="(\/assets\/[^" ]+\.js)"/)[1]
    assert.equal((await app.inject({ url: script })).statusCode, 200)
    assert.equal((await app.inject({ url: '/assets/does-not-exist.js' })).statusCode, 404)
    assert.equal((await app.inject({ url: '/api/private-unknown' })).statusCode, 404)
    assert.equal((await app.inject({ url: '/dashboard/1100000000000000001/tickets/panels' })).statusCode, 200)
    assert.equal(
      (await app.inject({ url: '/api/guilds/1100000000000000001/tickets/context' })).statusCode,
      401,
    )
    assert.equal(
      (
        await app.inject({
          url: '/api/guilds/1100000000000000001/tickets/00000000-0000-4000-8000-000000000000/transcript',
        })
      ).statusCode,
      401,
    )
    assert.match(String(page.headers['content-security-policy']), /frame-ancestors 'none'/)
    assert.equal(
      (
        await app.inject({
          url: '/api/guilds/1100000000000000001/tickets/00000000-0000-4000-8000-000000000000/transcript/view',
        })
      ).statusCode,
      401,
    )
    assert.ok(!page.body.includes('test-only'))
  } finally {
    await app.close()
  }
})
