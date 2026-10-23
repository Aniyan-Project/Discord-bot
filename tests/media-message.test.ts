import test from 'node:test'
import assert from 'node:assert/strict'
import { MessageFlags } from 'discord.js'
import { mediaChoiceValue, selectedMediaId, mediaDetailComponents } from '../server/media-message.js'
import { payload } from '../server/bot.js'
import { CommandEngine } from '../server/commands.js'
import { BranilistService } from '../server/branilist.js'
import { Store } from '../server/store.js'
import { loadConfig } from '../server/config.js'
import { defaultSettings, type MediaCard } from '../shared/domain.js'
import { demoMedia } from '../shared/example-media.js'

const sample: MediaCard = {
  ...demoMedia[0]!,
  genres: ['Aventura', 'Fantasia'],
  relations: [
    {
      type: 'SEQUEL',
      media: {
        ...demoMedia[0]!,
        id: '7525',
        slug: 'frieren-2',
        title: { ...demoMedia[0]!.title, romaji: 'Frieren 2nd Season' },
      },
    },
    {
      type: 'PREQUEL',
      media: {
        ...demoMedia[0]!,
        id: '1',
        slug: 'prequel',
        title: { ...demoMedia[0]!.title, romaji: 'Prequel' },
      },
    },
  ],
}
const config = () =>
  loadConfig({
    NODE_ENV: 'test',
    DEMO_MODE: 'true',
    DATABASE_PATH: ':memory:',
    ENCRYPTION_KEY: '55'.repeat(32),
  })
const ctx = {
  userId: 'user',
  guildId: 'guild',
  channelId: 'channel',
  locale: 'pt-BR' as const,
  source: 'slash' as const,
  manageGuild: false,
}

test('selecting autocomplete fetches the exact media ID without searching its title again', async () => {
  const cfg = config(),
    store = new Store(':memory:', cfg.ENCRYPTION_KEY)
  class FakeAPI extends BranilistService {
    override async mediaDetail(id: string) {
      assert.equal(id, '79')
      return sample
    }
    override async search(): ReturnType<BranilistService['search']> {
      throw Error('Autocomplete must not run a second title search')
    }
  }
  try {
    const engine = new CommandEngine(cfg, store, new FakeAPI(cfg, store))
    const response = await engine.execute('anime', [mediaChoiceValue('79')], ctx)
    assert.ok(response.componentsV2)
    assert.equal(response.embeds, undefined)
    assert.match(JSON.stringify(response), /Sousou no Frieren/)
    assert.equal(selectedMediaId('branilist:79'), '79')
    for (const invalid of ['Frieren', '79', 'branilist:0', 'branilist:79 extra', 'branilist:1e4'])
      assert.equal(selectedMediaId(invalid), undefined)
  } finally {
    store.close()
  }
})

test('a selected manga cannot be displayed through the anime command', async () => {
  const cfg = config(),
    store = new Store(':memory:', cfg.ENCRYPTION_KEY)
  class FakeAPI extends BranilistService {
    override async mediaDetail() {
      return { ...sample, type: 'MANGA' as const }
    }
  }
  try {
    await assert.rejects(
      new CommandEngine(cfg, store, new FakeAPI(cfg, store)).execute('anime', ['branilist:79'], ctx),
      /notFound/,
    )
  } finally {
    store.close()
  }
})

test('free-text searches with multiple matches keep the current search layout pending approval', async () => {
  const cfg = config(),
    store = new Store(':memory:', cfg.ENCRYPTION_KEY)
  class FakeAPI extends BranilistService {
    override async search() {
      return {
        nodes: [sample, { ...sample, id: '7525' }],
        pageInfo: { limit: 12, offset: 0, hasNextPage: false },
      }
    }
    override async mediaDetail(): Promise<MediaCard> {
      throw Error('A list must not guess which work was requested')
    }
  }
  try {
    const result = await new CommandEngine(cfg, store, new FakeAPI(cfg, store)).execute(
      'anime',
      ['Frieren'],
      ctx,
    )
    assert.ok(result.embeds?.length)
    assert.equal(result.componentsV2, undefined)
  } finally {
    store.close()
  }
})

test('Components V2 detail includes genres/status and ordered relations after a native separator', () => {
  const result = mediaDetailComponents(sample, defaultSettings)
  const serialized = JSON.stringify(result)
  assert.match(serialized, /Gêneros/)
  assert.match(serialized, /Finalizado/)
  assert.ok(serialized.indexOf('Prequela') < serialized.indexOf('Sequência'))
  const separator = result[0]!.components.findIndex((c) => c.type === 14)
  assert.ok(separator > 0)
  assert.match(JSON.stringify(result[0]!.components[separator + 1]), /Relações/)
  const message = payload({ componentsV2: result })
  assert.equal(message.flags, MessageFlags.IsComponentsV2)
  assert.equal('content' in message, false)
  assert.equal('embeds' in message, false)
  assert.deepEqual(message.allowedMentions.parse, [])
})

test('missing relations omit the divider and existing cover/synopsis/locale preferences still apply', () => {
  const result = mediaDetailComponents(
    { ...sample, relations: [] },
    { ...defaultSettings, locale: 'es', showCovers: false, showDescriptions: false },
  )
  assert.ok(!result[0]!.components.some((c) => c.type === 14 || c.type === 9))
  const serialized = JSON.stringify(result)
  assert.match(serialized, /Géneros/)
  assert.match(serialized, /Estado/)
  assert.doesNotMatch(serialized, /Sinopsis|Relações|"type":11/)
  assert.match(
    JSON.stringify(mediaDetailComponents({ ...sample, status: 'UPCOMING' }, defaultSettings)),
    /Ainda não lançado/,
  )
})

test('long catalog text stays under the Discord aggregate text budget and relation limit', () => {
  const long = {
    ...sample,
    description: '*'.repeat(10000),
    genres: Array(25).fill('*'.repeat(100)),
    relations: Array(30).fill({
      type: 'SEQUEL',
      media: { ...sample, slug: 'x'.repeat(500), title: { ...sample.title, romaji: '*'.repeat(1000) } },
    }),
  }
  const result = mediaDetailComponents(long, defaultSettings)
  let count = 0
  const visit = (component: unknown) => {
    const c = component as { content?: string; components?: unknown[] }
    count += c.content?.length ?? 0
    c.components?.forEach(visit)
  }
  result.forEach(visit)
  assert.ok(count <= 4000, `Text content: ${count}`)
  assert.match(JSON.stringify(result), /Ver outras relações/)
})
