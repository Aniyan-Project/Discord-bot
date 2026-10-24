import test from 'node:test'
import assert from 'node:assert/strict'
import { Collection, PermissionFlagsBits as P, type Client, type REST } from 'discord.js'
import {
  parseStudioDraft,
  studioPayload,
  validateStudioPayload,
  type StudioDraft,
} from '../shared/message-studio.js'
import { MessageStudio } from '../server/message-studio.js'
import { AppError } from '../server/security.js'

export function messageDraft(): StudioDraft {
  return {
    version: 1,
    name: 'Welcome',
    mode: 'classic',
    channelId: '1200000000000000001',
    sender: { type: 'bot', name: '{{server}}', avatar: '{{serverIcon}}' },
    mentions: [],
    content: 'Hello {{userMention}}',
    embeds: [
      {
        title: '{{server}}',
        description: '{{memberCount}} members',
        author: { name: '{{user}}', icon_url: '{{serverIcon}}' },
      },
    ],
    components: [
      {
        type: 17,
        components: [
          { type: 10, content: 'Hello {{server}}' },
          { type: 14, divider: true, spacing: 1 },
          { type: 1, components: [{ type: 2, style: 5, label: 'Branilist', url: 'https://branilist.com' }] },
        ],
      },
    ],
  }
}
const vars = {
  server: 'Club',
  memberCount: '128',
  user: 'Hanami',
  userMention: '<@1000000000000000001>',
  serverIcon: '',
}
test('message variables resolve without recursively interpreting user data or enabling mentions', () => {
  const p = studioPayload(parseStudioDraft(messageDraft()), { ...vars, server: 'Club {{unknown}}' })
  assert.equal(p.embeds?.[0]?.title, 'Club {{unknown}}')
  assert.equal(p.embeds?.[0]?.author?.icon_url, undefined)
  assert.deepEqual(p.allowed_mentions, { parse: [], replied_user: false })
  assert.deepEqual(validateStudioPayload(p), [])
  assert.throws(() => studioPayload(messageDraft(), {}), /unknownVariable/)
  const webhook = messageDraft()
  webhook.sender.type = 'webhook'
  assert.equal(studioPayload(webhook, vars).avatar_url, undefined)
})
test('classic messages enforce resolved limits, empty fields, URLs and aggregate characters', () => {
  const draft = messageDraft()
  draft.embeds = [{ description: '{{server}}' }]
  assert.ok(validateStudioPayload(studioPayload(draft, { ...vars, server: 'x'.repeat(4097) })).length)
  draft.embeds = [{ description: 'x'.repeat(4000) }, { description: 'x'.repeat(3000) }]
  assert.ok(validateStudioPayload(studioPayload(draft, vars)).includes('embeds.limit6000'))
  for (const url of ['http://localhost', 'javascript:alert(1)', 'https://user:pass@example.com']) {
    draft.embeds = [{ title: 'a', image: { url } }]
    assert.ok(validateStudioPayload(studioPayload(draft, vars)).length)
  }
  draft.content = ''
  draft.embeds = [{ color: 123 }]
  assert.ok(validateStudioPayload(studioPayload(draft, vars)).includes('embed1.empty'))
  draft.embeds = [{ fields: [{ name: '', value: 'a' }] }]
  assert.ok(validateStudioPayload(studioPayload(draft, vars)).includes('embed1.fieldName'))
})
test('V2 payloads exclude legacy fields and validate nesting, total count, text and accessories', () => {
  const draft = messageDraft()
  draft.mode = 'v2'
  let p = studioPayload(parseStudioDraft(draft), vars)
  assert.equal(p.flags, 32768)
  assert.equal(p.embeds, undefined)
  assert.equal(p.content, undefined)
  assert.deepEqual(validateStudioPayload(p), [])
  draft.components = [{ type: 17, components: [{ type: 17, components: [{ type: 10, content: 'nested' }] }] }]
  assert.ok(validateStudioPayload(studioPayload(draft, vars)).includes('components.nesting'))
  draft.components = [
    { type: 17, components: Array.from({ length: 40 }, () => ({ type: 10, content: 'x' })) },
  ]
  assert.ok(validateStudioPayload(studioPayload(draft, vars)).includes('components.limit40'))
  draft.components = [
    { type: 9, components: [{ type: 10, content: 'x' }], accessory: { type: 11, media: { url: '' } } },
  ]
  assert.ok(validateStudioPayload(studioPayload(draft, vars)).includes('components.thumbnail'))
  draft.components = [{ type: 10, content: 'x'.repeat(4001) }]
  p = studioPayload(draft, vars)
  assert.ok(validateStudioPayload(p).includes('components.limit4000'))
})
test('untrusted draft parsing rejects malformed structures, unsupported interactive IDs and unsafe keys', () => {
  assert.throws(() => parseStudioDraft({ ...messageDraft(), embeds: [{ fields: { name: 'a' } }] }))
  assert.throws(() =>
    parseStudioDraft({ ...messageDraft(), components: [{ type: 2, style: 1, custom_id: 'admin' }] }),
  )
  assert.throws(() =>
    parseStudioDraft({ ...messageDraft(), sender: { type: 'webhook', name: 'x', avatar: {} } }),
  )
  assert.throws(() =>
    parseStudioDraft(
      JSON.parse(
        JSON.stringify(messageDraft()).replace('"name":"Welcome"', '"__proto__":{},"name":"Welcome"'),
      ),
    ),
  )
  let deep: unknown = {}
  for (let i = 0; i < 30; i++) deep = { components: [deep] }
  assert.throws(() => parseStudioDraft({ ...messageDraft(), components: [deep] }))
})

function discordFixture() {
  const user = { id: '1000000000000000001', username: 'Hanami', avatar: null }
  const calls: Array<{ route: string; body: Record<string, unknown> }> = []
  const permissions = {
    actor: new Set<bigint>([
      P.ViewChannel,
      P.SendMessages,
      P.EmbedLinks,
      P.ManageWebhooks,
      P.MentionEveryone,
    ]),
    bot: new Set<bigint>([P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ManageWebhooks]),
  }
  const actor = {
    id: user.id,
    displayName: 'Hanami',
    permissions: { has: () => true },
    displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png',
  }
  const bot = { id: 'bot' }
  let created = 0
  const hooks = new Collection<string, { id: string; owner: { id: string }; name: string; token: string }>()
  const channel = {
    id: '1200000000000000001',
    name: 'anime',
    type: 0,
    permissionsFor: (who: unknown) => ({
      has: (value: bigint | bigint[]) =>
        (Array.isArray(value) ? value : [value]).every((v) =>
          (who === actor ? permissions.actor : permissions.bot).has(v),
        ),
    }),
    fetchWebhooks: async () => hooks,
    createWebhook: async () => {
      created++
      const hook = {
        id: '1400000000000000001',
        owner: { id: 'bot' },
        name: 'Branilist Bot · Studio',
        token: 'private-token',
      }
      hooks.set(hook.id, hook)
      return hook
    },
  }
  const guild = {
    name: 'Real server',
    memberCount: 451,
    iconURL: () => null,
    members: { fetch: async () => actor, fetchMe: async () => bot },
    channels: { fetch: async (id?: string) => (id ? channel : new Collection([[channel.id, channel]])) },
  }
  const client = {
    isReady: () => true,
    user: { id: 'bot' },
    guilds: { cache: new Map([['1100000000000000001', guild]]), fetch: async () => guild },
    rest: {
      post: async (route: string, options: { body: Record<string, unknown> }) => {
        calls.push({ route, body: options.body })
        return { id: '1500000000000000001' }
      },
    },
  }
  return {
    studio: new MessageStudio(
      client as unknown as Client,
      false,
      client.rest as unknown as Pick<REST, 'post'>,
    ),
    user,
    calls,
    permissions,
    hooks,
    created: () => created,
    actor,
  }
}
test('bot sending resolves fresh Discord context and excludes webhook identity fields', async () => {
  const f = discordFixture(),
    draft = messageDraft()
  const result = await f.studio.send(
    '1100000000000000001',
    f.user,
    'pt-BR',
    draft,
    'b930b91b-1d00-4810-8f62-2706568a9fd6',
  )
  assert.equal(result.demo, false)
  assert.ok(result.url?.includes('/1500000000000000001'))
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0]?.body.username, undefined)
  const embeds = f.calls[0]?.body.embeds as Array<{ title: string }>
  assert.equal(embeds[0]?.title, 'Real server')
  assert.equal(f.calls[0]?.body.enforce_nonce, true)
})
test('webhook sends reuse only bot-owned studio hooks, override identity and support V2', async () => {
  const f = discordFixture(),
    draft = messageDraft()
  draft.mode = 'v2'
  draft.sender.type = 'webhook'
  draft.sender.avatar = 'https://example.com/avatar.png'
  f.hooks.set('foreign', {
    id: 'foreign',
    owner: { id: 'other-bot' },
    name: 'Branilist Bot · Studio',
    token: 'foreign-token',
  })
  for (let i = 0; i < 2; i++)
    await f.studio.send('1100000000000000001', f.user, 'en', draft, crypto.randomUUID())
  assert.equal(f.created(), 1)
  assert.equal(f.calls.length, 2)
  assert.equal(f.calls[0]?.body.username, 'Real server')
  assert.equal(f.calls[0]?.body.avatar_url, draft.sender.avatar)
  assert.equal(f.calls[0]?.body.flags, 32768)
  assert.equal(f.calls[0]?.body.content, undefined)
  assert.ok(!JSON.stringify(f.calls).includes('foreign-token'))
})
test('channel, actor, bot and mention permissions are checked before any send', async () => {
  const guild = '1100000000000000001',
    f = discordFixture(),
    draft = messageDraft()
  draft.channelId = '9999999999999999999'
  await assert.rejects(
    f.studio.send(guild, f.user, 'en', draft, crypto.randomUUID()),
    (e: unknown) => e instanceof AppError && e.code === 'studioChannelDenied',
  )
  draft.channelId = '1200000000000000001'
  draft.sender.type = 'webhook'
  f.permissions.actor.delete(P.ManageWebhooks)
  await assert.rejects(f.studio.send(guild, f.user, 'en', draft, crypto.randomUUID()), /studioWebhookDenied/)
  f.permissions.actor.add(P.ManageWebhooks)
  f.permissions.bot.delete(P.ManageWebhooks)
  await assert.rejects(f.studio.send(guild, f.user, 'en', draft, crypto.randomUUID()), /studioWebhookDenied/)
  draft.sender.type = 'bot'
  draft.mentions = ['everyone']
  f.permissions.actor.delete(P.MentionEveryone)
  await assert.rejects(f.studio.send(guild, f.user, 'en', draft, crypto.randomUUID()), /studioMentionDenied/)
  draft.mentions = []
  f.permissions.bot.delete(P.EmbedLinks)
  await assert.rejects(f.studio.send(guild, f.user, 'en', draft, crypto.randomUUID()), /studioChannelDenied/)
  assert.equal(f.calls.length, 0)
})
