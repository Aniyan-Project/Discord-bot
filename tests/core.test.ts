import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { Vault, AppError, canManageGuild, hashToken } from '../server/security.js'
import { Store } from '../server/store.js'
import { tokenize, parsePrefix, Cooldowns } from '../server/parser.js'
import { loadConfig } from '../server/config.js'
import { CommandEngine } from '../server/commands.js'
import { BranilistService } from '../server/branilist.js'
import { createSlashCommands } from '../server/slash-commands.js'
import { commandIds, defaultSettings, guildSettingsSchema } from '../shared/domain.js'
import { messageKeys, t } from '../shared/i18n.js'
import { demoMedia } from '../shared/example-media.js'
const key = '11'.repeat(32)
function config() {
  return loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'true', DATABASE_PATH: ':memory:', ENCRYPTION_KEY: key })
}

test('AES-GCM protects credentials, detects tampering and binds records to their owner', () => {
  const vault = new Vault(key)
  const value = { token: 'super-secret' }
  const encrypted = vault.encrypt(value, 'account:one')
  assert.ok(!encrypted.includes(value.token))
  assert.deepEqual(vault.decrypt(encrypted, 'account:one'), value)
  assert.notEqual(encrypted, vault.encrypt(value, 'account:one'))
  assert.throws(() => vault.decrypt(encrypted, 'account:two'))
  assert.throws(() => new Vault(randomBytes(32).toString('hex')).decrypt(encrypted, 'account:one'))
  const parts = encrypted.split('.')
  parts[2] = Buffer.from('tampered').toString('base64url')
  assert.throws(() => vault.decrypt(parts.join('.'), 'account:one'))
})
test('prefix parser handles configured prefixes, translated aliases, quotes and literal metacharacters', () => {
  assert.deepEqual(parsePrefix('??anime "Sousou no Frieren"', '??'), {
    command: 'anime',
    args: ['Sousou no Frieren'],
  })
  assert.equal(parsePrefix('b!perfil 123456', 'b!')?.command, 'profile')
  assert.equal(parsePrefix('!biblioteca', '!')?.command, 'library')
  assert.deepEqual(tokenize('anime "hello world" $(echo) `literal`'), [
    'anime',
    'hello world',
    '$(echo)',
    '`literal`',
  ])
  assert.equal(parsePrefix('hello', '!'), null)
  assert.equal(parsePrefix('!unknown', '!'), null)
  assert.throws(() => tokenize('"unterminated'))
})
test('settings reject invalid prefixes, unknown commands, both modes off and malformed channel IDs', () => {
  for (const change of [
    { prefix: '@everyone' },
    { prefix: 'two words' },
    { prefix: '' },
    { prefixEnabled: false, slashEnabled: false },
    { cooldownSeconds: 0 },
    { embedColor: 'red;display:none' },
    { allowedChannelIds: ['../../private'] },
    { disabledCommands: ['shell'] },
  ])
    assert.equal(guildSettingsSchema.safeParse({ ...defaultSettings, ...change }).success, false)
  assert.equal(
    guildSettingsSchema.safeParse({ ...defaultSettings, prefix: '??', locale: 'es' }).success,
    true,
  )
})
test('server settings remain isolated, revision checked and audit history omits values', async () => {
  const store = new Store(':memory:', key)
  try {
    const saved = store.saveSettings('one', { ...defaultSettings, prefix: '?' }, 0, 'manager')
    assert.equal(saved.revision, 1)
    assert.equal(store.settings('two').settings.prefix, 'b!')
    assert.throws(() => store.saveSettings('one', defaultSettings, 0, 'manager'))
    assert.deepEqual(
      JSON.parse(
        (store.db.prepare('SELECT changed_fields FROM audit_events').get() as { changed_fields: string })
          .changed_fields,
      ),
      ['prefix'],
    )
    const order: number[] = []
    await Promise.all([
      store.withGuildLock('one', async () => {
        order.push(1)
        await new Promise((r) => setTimeout(r, 10))
        order.push(2)
      }),
      store.withGuildLock('one', async () => {
        order.push(3)
      }),
    ])
    assert.deepEqual(order, [1, 2, 3])
  } finally {
    store.close()
  }
})
test('sessions and OAuth states are encrypted, bounded, single-use and flow-specific', () => {
  const store = new Store(':memory:', key)
  try {
    const s = store.createSession(
      { id: '1', username: 'one', avatar: null },
      {
        access_token: 'private-access-token',
        refresh_token: 'private-refresh-token',
        expiresAt: Date.now() + 1000,
      },
    )
    const row = store.db.prepare('SELECT id,payload FROM sessions').get() as { id: string; payload: string }
    assert.equal(row.id, hashToken(s.id))
    assert.ok(!row.payload.includes('private-access-token'))
    assert.equal(store.session(s.id)?.user.id, '1')
    s.expiresAt = Date.now() - 1
    store.putSession(s)
    assert.equal(store.session(s.id), null)
    const state = store.createState('discord', { verifier: 'secret' })
    assert.equal(store.takeState(state, 'branilist'), null)
    assert.deepEqual(store.takeState(state, 'discord'), { verifier: 'secret' })
    assert.equal(store.takeState(state, 'discord'), null)
    const expired = store.createState('discord', {})
    store.db.prepare('UPDATE oauth_states SET expires_at=0').run()
    assert.equal(store.takeState(expired, 'discord'), null)
  } finally {
    store.close()
  }
})
test('guild permissions use BigInt and never require Administrator', () => {
  assert.equal(canManageGuild({ permissions: '32' }), true)
  assert.equal(canManageGuild({ permissions: '8' }), true)
  assert.equal(canManageGuild({ owner: true, permissions: '0' }), true)
  assert.equal(canManageGuild({ permissions: '9223372036854775840' }), true)
  assert.equal(canManageGuild({ permissions: '0' }), false)
  assert.equal(canManageGuild({ permissions: 'not-a-number' }), false)
})
test('cooldowns isolate users and allow requests again after expiry', () => {
  const c = new Cooldowns()
  assert.equal(c.check('guild:a', 5, 1000), 0)
  assert.equal(c.check('guild:a', 5, 2000), 4)
  assert.equal(c.check('guild:b', 5, 2000), 0)
  assert.equal(c.check('guild:a', 5, 7000), 0)
})
test('production rejects demo mode, insecure origins and missing encryption configuration', () => {
  assert.throws(() =>
    loadConfig({ NODE_ENV: 'production', DEMO_MODE: 'true', APP_URL: 'https://bot.example' }),
  )
  assert.throws(() =>
    loadConfig({ NODE_ENV: 'production', APP_URL: 'http://bot.example', ENCRYPTION_KEY: key }),
  )
  assert.throws(() => loadConfig({ NODE_ENV: 'test' }))
  assert.throws(() => loadConfig({ DEMO_MODE: 'true', DEFAULT_PREFIX: '@all' }))
})
test('all slash commands and options provide Portuguese, English and Spanish descriptions', () => {
  const commands = createSlashCommands()
  assert.equal(commands.length, commandIds.length)
  for (const command of commands) {
    assert.ok(command.description.length <= 100)
    assert.ok(command.description_localizations?.['pt-BR'])
    assert.ok(command.description_localizations?.['es-ES'])
    for (const option of command.options ?? []) {
      assert.ok(option.description_localizations?.['pt-BR'])
      assert.ok(option.description_localizations?.['es-ES'])
    }
  }
  assert.equal(new Set(commands.map((c) => c.name)).size, commands.length)
  const settings = commands.find((c) => c.name === 'settings')!
  assert.equal(settings.default_member_permissions, '32')
})
test('all application messages have translations and preserve template parameters', () => {
  for (const message of messageKeys) {
    const originals = (['pt-BR', 'en', 'es'] as const).map((locale) => t(locale, message))
    for (const text of originals) assert.ok(text.length > 0)
    const placeholders = originals.map((text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort())
    assert.deepEqual(placeholders[0], placeholders[1])
    assert.deepEqual(placeholders[0], placeholders[2])
  }
})
test('commands perform real demo CRUD, enforce access settings and protect confirmation ownership', async () => {
  const cfg = config()
  const store = new Store(':memory:', key)
  const api = new BranilistService(cfg, store)
  const engine = new CommandEngine(cfg, store, api)
  const invocation = {
    userId: 'one',
    guildId: 'guild',
    channelId: '1200000000000000001',
    locale: 'pt-BR' as const,
    manageGuild: false,
    source: 'prefix' as const,
  }
  const run = (name: Parameters<typeof engine.execute>[0], args: string[] = []) =>
    engine.execute(name, args, { ...invocation, userId: `${name}-user` })
  try {
    assert.ok((await run('anime', ['Frieren'])).componentsV2?.length)
    assert.equal((await run('library')).private, true)
    await run('progress', [demoMedia[0]!.id, '7'])
    assert.equal((await api.library('one')).nodes.find((e) => e.mediaId === demoMedia[0]!.id)?.progress, 7)
    const pending = await run('remove', [demoMedia[0]!.id])
    assert.ok(pending.confirm)
    await assert.rejects(
      engine.confirm(pending.confirm.token, invocation),
      (e) => e instanceof AppError && e.code === 'ownButtonOnly',
    )
    const context = engine.actionContext(pending.confirm.token, 'remove-user')
    await engine.confirm(pending.confirm.token, context)
    assert.ok(!(await api.library('one')).nodes.some((e) => e.mediaId === demoMedia[0]!.id))
    await assert.rejects(engine.confirm(pending.confirm.token, context))
    await assert.rejects(
      run('settings', ['prefix', '?']),
      (e) => e instanceof AppError && e.code === 'forbidden',
    )
    store.saveSettings('guild', { ...defaultSettings, disabledCommands: ['manga'] }, 0, 'manager')
    await assert.rejects(run('manga', ['one']), (e) => e instanceof AppError && e.code === 'disabled')
  } finally {
    store.close()
  }
})
test('confirmations preserve original channel policy when delivered by DM', async () => {
  const cfg = config()
  const store = new Store(':memory:', key)
  const api = new BranilistService(cfg, store)
  const engine = new CommandEngine(cfg, store, api)
  try {
    store.saveSettings(
      'guild',
      { ...defaultSettings, allowedChannelIds: ['1200000000000000001'] },
      0,
      'manager',
    )
    const ctx = {
      userId: 'one',
      guildId: 'guild',
      channelId: '1200000000000000001',
      locale: 'en' as const,
      manageGuild: false,
      source: 'prefix' as const,
    }
    const result = await engine.execute('remove', [demoMedia[0]!.id], ctx)
    const confirmed = await engine.confirm(result.confirm!.token, {
      ...ctx,
      channelId: 'private-dm',
      guildId: undefined,
    })
    assert.ok(confirmed.private)
  } finally {
    store.close()
  }
})
