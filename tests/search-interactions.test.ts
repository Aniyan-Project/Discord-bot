import test from 'node:test'
import assert from 'node:assert/strict'
import { Events, MessageFlags } from 'discord.js'
import { loadConfig } from '../server/config.js'
import { Store } from '../server/store.js'
import { BranilistService } from '../server/branilist.js'
import { CommandEngine, type CommandResult, type Invocation } from '../server/bot/core/engine.js'
import { BotRuntime } from '../server/bot/runtime.js'
import { payload } from '../server/bot/presentation/payload.js'
import { mediaSearchComponents } from '../server/bot/presentation/media/index.js'
import { defaultSettings, type MediaCard } from '../shared/domain.js'
import { demoMedia } from '../shared/example-media.js'

const cfg = () =>
  loadConfig({
    NODE_ENV: 'test',
    DEMO_MODE: 'true',
    DATABASE_PATH: ':memory:',
    ENCRYPTION_KEY: '77'.repeat(32),
  })
const ctx: Invocation = {
  userId: 'owner',
  guildId: 'guild',
  channelId: '1200000000000000001',
  locale: 'pt-BR',
  manageGuild: false,
  source: 'slash',
}
const catalog = Array.from({ length: 11 }, (_, i) => ({
  ...demoMedia[0]!,
  id: String(i + 1),
  title: { ...demoMedia[0]!.title, romaji: `Frieren ${i + 1}` },
}))
class FakeAPI extends BranilistService {
  calls: number[] = []
  override async search(_query = '', type?: 'ANIME' | 'MANGA', offset = 0, first = 12) {
    this.calls.push(offset)
    return {
      nodes: catalog.slice(offset, offset + first).map((m) => ({ ...m, type: type ?? 'ANIME' })),
      pageInfo: { limit: first, offset, hasNextPage: offset + first < catalog.length },
    }
  }
  override async mediaDetail(id: string): Promise<MediaCard> {
    return catalog.find((m) => m.id === id)!
  }
}
function token(result: CommandResult) {
  const value = JSON.stringify(result).match(/media:select:([\w-]+)/)?.[1]
  assert.ok(value, 'Result must contain a selection token')
  return value
}
function allComponents(result: CommandResult) {
  const found: Array<Record<string, unknown>> = []
  function visit(c: unknown) {
    const value = c as Record<string, unknown>
    found.push(value)
    ;(value.components as unknown[] | undefined)?.forEach(visit)
    if (value.accessory) visit(value.accessory)
  }
  result.componentsV2?.forEach(visit)
  return found
}
function fixture() {
  const config = cfg(),
    store = new Store(':memory:', config.ENCRYPTION_KEY),
    api = new FakeAPI(config, store)
  return { config, store, api, engine: new CommandEngine(config, store, api) }
}

test('selection replaces the results with exact details and consumes the menu token', async () => {
  const { store, engine } = fixture()
  try {
    const results = await engine.execute('anime', ['Frieren'], ctx)
    const id = token(results)
    const menu = allComponents(results).find((c) => c.type === 3)!
    assert.equal((menu.options as unknown[]).length, 5)
    const detail = await engine.interactSearch(id, ctx, 'select', 'branilist:3')
    assert.match(JSON.stringify(detail), /Frieren 3/)
    assert.doesNotMatch(JSON.stringify(detail), /media:select:/)
    assert.equal(payload(detail).flags, MessageFlags.IsComponentsV2)
    assert.throws(() => engine.searchContext(id, ctx.userId), /expired/)
  } finally {
    store.close()
  }
})

test('manga selection opens the manga detail and an empty later page preserves V2 navigation', async () => {
  const { config, store } = fixture(),
    original = Date.now
  let now = original()
  Date.now = () => now
  class MangaAPI extends FakeAPI {
    override async mediaDetail(id: string) {
      return { ...(await super.mediaDetail(id)), type: 'MANGA' as const }
    }
  }
  const api = new MangaAPI(config, store),
    engine = new CommandEngine(config, store, api)
  try {
    const id = token(await engine.execute('manga', ['Frieren'], ctx))
    assert.match(JSON.stringify(await engine.interactSearch(id, ctx, 'select', 'branilist:2')), /capítulos/)
    now += 6000
    const another = token(await engine.execute('anime', ['Frieren'], ctx))
    api.search = async () => ({ nodes: [], pageInfo: { limit: 5, offset: 5, hasNextPage: false } })
    now += 1100
    const empty = await engine.interactSearch(another, ctx, 'next')
    assert.equal(payload(empty).flags, MessageFlags.IsComponentsV2)
    assert.ok(!allComponents(empty).some((c) => c.type === 3))
    assert.equal(
      allComponents(empty).find((c) => String(c.custom_id).includes('media:prev:'))?.disabled,
      false,
    )
  } finally {
    Date.now = original
    store.close()
  }
})

test('pagination advances by five, rotates tokens and disables navigation at each boundary', async () => {
  const { store, engine, api } = fixture(),
    original = Date.now
  let now = original()
  Date.now = () => now
  try {
    const first = await engine.execute('anime', ['Frieren'], ctx),
      firstToken = token(first)
    assert.equal(
      allComponents(first).find((c) => String(c.custom_id).includes('media:prev:'))?.disabled,
      true,
    )
    const second = await engine.interactSearch(firstToken, ctx, 'next')
    assert.throws(() => engine.searchContext(firstToken, ctx.userId), /expired/)
    assert.match(JSON.stringify(second), /Página 2/)
    assert.doesNotMatch(JSON.stringify(second), /\*\*Frieren 1\*\*/)
    now += 1100
    const third = await engine.interactSearch(token(second), ctx, 'next')
    assert.equal(
      allComponents(third).find((c) => String(c.custom_id).includes('media:next:'))?.disabled,
      true,
    )
    assert.equal((allComponents(third).find((c) => c.type === 3)?.options as unknown[]).length, 1)
    now += 1100
    const previous = await engine.interactSearch(token(third), ctx, 'prev')
    assert.match(JSON.stringify(previous), /Página 2/)
    assert.deepEqual(api.calls, [0, 5, 10, 5])
  } finally {
    Date.now = original
    store.close()
  }
})

test('menus reject other users, other channels and IDs that were not on the displayed page', async () => {
  const { store, engine } = fixture()
  try {
    const id = token(await engine.execute('anime', ['Frieren'], ctx))
    await assert.rejects(
      engine.interactSearch(id, { ...ctx, userId: 'stranger' }, 'select', 'branilist:1'),
      /ownSearchOnly/,
    )
    await assert.rejects(
      engine.interactSearch(id, { ...ctx, channelId: 'other-channel' }, 'select', 'branilist:1'),
      /forbidden/,
    )
    await assert.rejects(engine.interactSearch(id, ctx, 'select', 'branilist:11'), /invalidInput/)
  } finally {
    store.close()
  }
})

test('prefix-origin menus recheck current command mode and channel policy', async () => {
  const { store, engine } = fixture()
  try {
    const prefix = { ...ctx, source: 'prefix' as const }
    const id = token(await engine.execute('anime', ['Frieren'], prefix))
    store.saveSettings('guild', { ...defaultSettings, prefixEnabled: false }, 0, 'manager')
    await assert.rejects(engine.interactSearch(id, prefix, 'select', 'branilist:1'), /disabled/)
    store.saveSettings(
      'guild',
      { ...defaultSettings, allowedChannelIds: ['1200000000000000002'] },
      1,
      'manager',
    )
    await assert.rejects(engine.interactSearch(id, prefix, 'select', 'branilist:1'), /wrongChannel/)
    store.saveSettings('guild', { ...defaultSettings, disabledCommands: ['anime'] }, 2, 'manager')
    await assert.rejects(engine.interactSearch(id, prefix, 'select', 'branilist:1'), /disabled/)
  } finally {
    store.close()
  }
})

test('expired menus cannot run requests and navigating does not extend their lifetime', async () => {
  const { store, engine, api } = fixture(),
    original = Date.now
  let now = original()
  Date.now = () => now
  try {
    const id = token(await engine.execute('anime', ['Frieren'], ctx))
    now += 299000
    const second = await engine.interactSearch(id, ctx, 'next')
    now += 1001
    await assert.rejects(engine.interactSearch(token(second), ctx, 'next'), /expired/)
    assert.deepEqual(api.calls, [0, 5])
  } finally {
    Date.now = original
    store.close()
  }
})

test('a slow selection blocks duplicate concurrent requests and can be retried after an API failure', async () => {
  const { config, store } = fixture(),
    original = Date.now
  let now = original()
  Date.now = () => now
  let release!: (media: MediaCard) => void
  let calls = 0
  class SlowAPI extends FakeAPI {
    override async mediaDetail() {
      calls++
      return new Promise<MediaCard>((resolve) => {
        release = resolve
      })
    }
  }
  const api = new SlowAPI(config, store),
    engine = new CommandEngine(config, store, api)
  try {
    const id = token(await engine.execute('anime', ['Frieren'], ctx))
    const pending = engine.interactSearch(id, ctx, 'select', 'branilist:1')
    await assert.rejects(engine.interactSearch(id, ctx, 'select', 'branilist:2'), /rateLimited/)
    assert.equal(calls, 1)
    release(catalog[0]!)
    await pending
    now += 1100
    const another = token(await engine.execute('anime', ['Frieren'], { ...ctx, userId: 'another' }))
    api.mediaDetail = async () => {
      throw Error('upstream unavailable')
    }
    await assert.rejects(
      engine.interactSearch(another, { ...ctx, userId: 'another' }, 'select', 'branilist:1'),
      /upstream unavailable/,
    )
    now += 1100
    api.mediaDetail = async () => catalog[0]!
    assert.ok(
      (await engine.interactSearch(another, { ...ctx, userId: 'another' }, 'select', 'branilist:1'))
        .componentsV2,
    )
  } finally {
    Date.now = original
    store.close()
  }
})

test('search rendering respects languages and covers and stays within native component/text limits', () => {
  for (const locale of ['pt-BR', 'en', 'es'] as const) {
    const result = {
      componentsV2: mediaSearchComponents(
        catalog,
        { ...defaultSettings, locale, showCovers: false },
        { query: '*'.repeat(150), token: 'token', offset: 0, hasNextPage: true },
      ),
    }
    const components = allComponents(result)
    assert.ok(components.length <= 40)
    assert.ok(
      components.reduce((sum, c) => sum + (typeof c.content === 'string' ? c.content.length : 0), 0) <= 4000,
    )
    assert.ok(!components.some((c) => c.type === 9 || c.type === 11))
    assert.equal((components.find((c) => c.type === 3)?.options as unknown[]).length, 5)
    assert.match(
      JSON.stringify(result),
      locale === 'en'
        ? /Search results/
        : locale === 'es'
          ? /Resultados de la búsqueda/
          : /Resultados da pesquisa/,
    )
  }
})

test('gateway acknowledges selection before fetching details and sends only Components V2 in the update', async () => {
  const { config, store } = fixture()
  let acknowledged = false
  class CheckedAPI extends FakeAPI {
    override async mediaDetail(id: string) {
      assert.equal(acknowledged, true)
      return super.mediaDetail(id)
    }
  }
  const bot = new BotRuntime(config, store, new CheckedAPI(config, store))
  try {
    const id = token(await bot.engine.execute('anime', ['Frieren'], ctx))
    let sent: unknown
    const interaction = {
      isChatInputCommand: () => false,
      isAutocomplete: () => false,
      isStringSelectMenu: () => true,
      isButton: () => false,
      customId: `media:select:${id}`,
      user: { id: 'owner' },
      locale: 'pt-BR',
      guildId: ctx.guildId,
      channelId: ctx.channelId,
      channel: { isThread: () => false },
      values: ['branilist:2'],
      deferred: false,
      replied: false,
      async deferUpdate() {
        acknowledged = true
        this.deferred = true
      },
      async editReply(value: unknown) {
        sent = value
      },
      async reply() {
        assert.fail('Unexpected error reply')
      },
      async followUp() {
        assert.fail('Unexpected follow-up')
      },
    }
    await bot.client.listeners(Events.InteractionCreate)[0]!(interaction)
    assert.ok(sent)
    assert.equal((sent as { flags: number }).flags, MessageFlags.IsComponentsV2)
    assert.equal('embeds' in (sent as object), false)
    assert.match(JSON.stringify(sent), /Frieren 2/)
  } finally {
    await bot.close()
    store.close()
  }
})
