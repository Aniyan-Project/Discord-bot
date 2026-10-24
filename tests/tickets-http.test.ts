import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../server/app.js'
import { loadConfig } from '../server/config.js'
const guild = '1100000000000000001'
test('ticket HTTP routes require a session, CSRF token and valid bounded input', async () => {
  const production = await createApp(
    loadConfig({
      NODE_ENV: 'test',
      DEMO_MODE: 'false',
      DATABASE_PATH: ':memory:',
      ENCRYPTION_KEY: '55'.repeat(32),
      APP_URL: 'http://localhost:5173',
      DISCORD_TOKEN: 'test',
      DISCORD_CLIENT_ID: '1100000000000000000',
      DISCORD_CLIENT_SECRET: 'test',
    }),
  )
  try {
    const r = await production.app.inject({ url: `/api/guilds/${guild}/tickets/context` })
    assert.equal(r.statusCode, 401)
  } finally {
    await production.app.close()
  }
  const demo = await createApp(
    loadConfig({
      NODE_ENV: 'test',
      DEMO_MODE: 'true',
      DATABASE_PATH: ':memory:',
      ENCRYPTION_KEY: '55'.repeat(32),
      APP_URL: 'http://localhost:5173',
    }),
  )
  try {
    const view = (await demo.app.inject({ url: '/api/session' })).json()
    const url = `/api/guilds/${guild}/tickets/settings`
    assert.equal((await demo.app.inject({ method: 'PUT', url, payload: {} })).statusCode, 403)
    assert.equal(
      (
        await demo.app.inject({
          method: 'PUT',
          url,
          headers: { origin: 'https://evil.example', 'x-csrf-token': view.csrfToken },
          payload: {},
        })
      ).statusCode,
      403,
    )
    assert.equal(
      (
        await demo.app.inject({
          method: 'PUT',
          url,
          headers: { origin: 'http://localhost:5173', 'x-csrf-token': view.csrfToken },
          payload: { settings: { maxActive: 999999 }, revision: 0 },
        })
      ).statusCode,
      400,
    )
    assert.equal(
      (await demo.app.inject({ url: `/api/guilds/${guild}/tickets/not-a-uuid/transcript` })).statusCode,
      400,
    )
    const context = (await demo.app.inject({ url: `/api/guilds/${guild}/tickets/context` })).json()
    assert.equal(context.demo, true)
    assert.equal(context.panels.length, 0)
  } finally {
    await demo.app.close()
  }
})
