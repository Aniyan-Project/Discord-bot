import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../server/app.js'
import { loadConfig } from '../server/config.js'
import { newTicketPanel, defaultTicketSettings } from '../shared/tickets.js'
import { randomUUID } from 'node:crypto'
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
    const path = `/transcripts/${guild}/00000000-0000-4000-8000-000000000000`
    const redirect = await production.app.inject({ url: path })
    assert.equal(redirect.statusCode, 302)
    assert.equal(redirect.headers.location, '/auth/discord?returnTo=' + encodeURIComponent(path))
    assert.equal(redirect.headers['cache-control'], 'no-store')
    for (const format of ['view', 'html']) {
      assert.equal(
        (
          await production.app.inject({
            url: `/api/guilds/${guild}/tickets/00000000-0000-4000-8000-000000000000/transcript/${format}`,
          })
        ).statusCode,
        401,
      )
    }
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

test('HTML viewer and download use fresh authorization, nonce CSP and retention without leaking internal notes', async () => {
  const runtime = await createApp(
    loadConfig({
      NODE_ENV: 'test',
      DEMO_MODE: 'true',
      DATABASE_PATH: ':memory:',
      ENCRYPTION_KEY: '55'.repeat(32),
      APP_URL: 'http://localhost:5173',
    }),
  )
  try {
    const service = runtime.bot.tickets,
      user = '1000000000000000001'
    await service.saveSettings(
      guild,
      user,
      {
        ...defaultTicketSettings,
        categoryId: '1300000000000000001',
        supportRoleIds: ['1400000000000000001'],
      },
      0,
    )
    const panel = newTicketPanel()
    panel.channelId = '1200000000000000001'
    const view = await service.savePanel(guild, user, panel, 0)
    await service.publish(guild, user, panel.id, randomUUID(), view.revision)
    const opened = await service.open(guild, user, panel.id, panel.topics[0]!.id, {
      [panel.topics[0]!.questions[0]!.id]: 'Example',
    })
    const closed = await service.action(guild, user, opened.id, 'close', 'Resolved')
    const saved = service.repo.save({
      ...closed,
      notes: [{ actor: user, at: Date.now(), text: 'SECRET NOTE NEVER EXPORTED' }],
    })
    const base = `/api/guilds/${guild}/tickets/${opened.id}/transcript`
    const page = await runtime.app.inject({ url: base + '/view' })
    assert.equal(page.statusCode, 200)
    assert.match(String(page.headers['content-type']), /text\/html/)
    assert.match(String(page.headers['content-security-policy']), /script-src 'nonce-/)
    assert.match(String(page.headers['content-security-policy']), /font-src data:/)
    assert.equal(page.headers['cache-control'], 'no-store')
    assert.ok(!page.body.includes('SECRET NOTE NEVER EXPORTED'))
    const website = await runtime.app.inject({ url: `/transcripts/${guild}/${opened.id}` })
    assert.equal(website.statusCode, 200)
    assert.equal(website.headers['content-disposition'], undefined)
    assert.equal(website.headers['cache-control'], 'no-store')
    assert.ok(!website.body.includes('SECRET NOTE NEVER EXPORTED'))
    const file = await runtime.app.inject({ url: base + '/html' })
    assert.equal(file.statusCode, 200)
    assert.match(String(file.headers['content-disposition']), /attachment; filename="ticket-.*\.html"/)
    service.repo.save({ ...saved, closedAt: Date.now() - 31 * 86400000 })
    assert.equal((await runtime.app.inject({ url: base + '/view' })).statusCode, 410)
  } finally {
    await runtime.app.close()
  }
})
