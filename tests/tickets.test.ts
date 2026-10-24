import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Client, ChannelType, PermissionFlagsBits as P } from 'discord.js'
import { Store } from '../server/store.js'
import { TicketDiscord, type TicketActor } from '../server/bot/tickets/discord.js'
import { TicketService } from '../server/bot/tickets/service.js'
import { AppError } from '../server/security.js'
import {
  newTicketPanel,
  defaultTicketSettings,
  panelSchema,
  type TicketRecord,
  type TicketPanel,
} from '../shared/tickets.js'
import { ticketInteractionHandler } from '../server/bot/tickets/interactions.js'
import { panelPayload, ticketControls, ticketLogPayload } from '../server/bot/tickets/messages.js'
const guild = '1100000000000000001',
  manager = '1000000000000000001',
  author = '1000000000000000002',
  support = '1000000000000000003',
  other = '1000000000000000004',
  role = '1400000000000000001',
  key = '55'.repeat(32)
export class FakeTicketDiscord extends TicketDiscord {
  people = new Map<string, TicketActor>([
    [manager, { id: manager, name: 'Manager', roles: [], manage: true }],
    [author, { id: author, name: 'Author', roles: [], manage: false }],
    [support, { id: support, name: 'Support', roles: [role], manage: false }],
    [other, { id: other, name: 'Other', roles: [], manage: false }],
  ])
  created = 0
  publications = 0
  uncertain = false
  accessCalls: TicketRecord[] = []
  closed = false
  constructor() {
    super(new Client({ intents: [] }), false, true, 'https://bot.example')
  }
  override async actor(g: string, id: string) {
    const p = this.people.get(id)
    if (g !== guild || !p) throw new AppError(403, 'forbidden')
    return p
  }
  override async resources() {
    return {
      channels: [{ id: '1200000000000000001', name: 'tickets' }],
      categories: [{ id: '1300000000000000001', name: 'Support' }],
      roles: [{ id: role, name: 'Support' }],
    }
  }
  override async validate() {}
  override async create() {
    this.created++
    if (this.uncertain) throw new AppError(502, 'ticketUncertain')
    return { channelId: '1500000000000000001', staffThreadId: null }
  }
  override async welcome() {}
  override async publish(_g: string, p: TicketPanel) {
    this.publications++
    if (this.uncertain) throw new AppError(502, 'ticketUncertain')
    return { id: '1600000000000000001', channelId: p.channelId, demo: false }
  }
  override async access(t: TicketRecord, closed = false) {
    this.accessCalls.push(t)
    this.closed = closed
  }
  override async transcript(t: TicketRecord) {
    return {
      messages: [
        {
          id: '1',
          author: t.authorName,
          authorId: t.authorId,
          at: Date.now(),
          content: 'private conversation',
          attachments: [],
        },
      ],
      truncated: false,
      contentAvailable: true,
      capturedAt: Date.now(),
    }
  }
  override async log() {}
  override async notice() {}
  override async dm() {}
  override async recover() {
    return null
  }
}
export async function ticketFixture() {
  const store = new Store(':memory:', key),
    discord = new FakeTicketDiscord(),
    service = new TicketService(store, discord, key)
  const settings = {
    ...defaultTicketSettings,
    categoryId: '1300000000000000001',
    supportRoleIds: [role],
    cooldownSeconds: 0,
  }
  await service.saveSettings(guild, manager, settings, 0)
  const panel = newTicketPanel()
  panel.channelId = '1200000000000000001'
  const view = await service.savePanel(guild, manager, panel, 0)
  await service.publish(guild, manager, panel.id, randomUUID(), view.revision)
  return {
    store,
    discord,
    service,
    panel,
    settings,
    answers: { [panel.topics[0]!.questions[0]!.id]: 'private answer' },
    close: () => store.close(),
  }
}
test('ticket panel constraints reject ambiguous topics and keep Discord payload formats separate', () => {
  const p = newTicketPanel()
  assert.ok(panelSchema.safeParse(p).success)
  assert.ok(!panelSchema.safeParse({ ...p, topics: [p.topics[0], p.topics[0]] }).success)
  const v2 = panelPayload(p, 'en')
  assert.equal(v2.flags, 32768)
  assert.equal(v2.embeds, undefined)
  const classic = panelPayload({ ...p, format: 'classic' }, 'es')
  assert.ok(classic.embeds?.length)
  assert.equal(classic.flags, undefined)
})
test('ticket lifecycle checks roles, encrypts sensitive data, transfers, closes and refreshes transcript after reopening', async () => {
  const f = await ticketFixture()
  try {
    const t = await f.service.open(guild, author, f.panel.id, f.panel.topics[0]!.id, f.answers)
    assert.equal(t.status, 'open')
    assert.equal(f.discord.created, 1)
    await assert.rejects(
      () => f.service.detail(guild, other, t.id),
      (e: unknown) => e instanceof AppError && e.status === 403,
    )
    await assert.rejects(() => f.service.detail('1100000000000000999', support, t.id))
    const claimed = await f.service.action(guild, support, t.id, 'claim')
    assert.equal(claimed.staffId, support)
    await f.service.action(guild, support, t.id, 'note', 'private staff note')
    const raw = String(f.store.db.prepare('SELECT payload FROM tickets WHERE id=?').get(t.id)?.payload)
    assert.ok(!raw.includes('private answer'))
    assert.ok(!raw.includes('private staff note'))
    await f.service.action(guild, manager, t.id, 'transfer', support)
    await f.service.action(guild, support, t.id, 'close', 'Resolved')
    assert.ok(f.discord.closed)
    const transcript = await f.service.transcript(guild, support, t.id)
    assert.equal(transcript.messages[0]?.content, 'private conversation')
    assert.ok(!JSON.stringify(transcript).includes('private staff note'))
    await assert.rejects(() => f.service.transcript(guild, author, t.id))
    await f.service.action(guild, support, t.id, 'reopen')
    assert.equal(f.service.repo.readTranscript(guild, t.id), null)
    f.discord.people.set(support, { id: support, name: 'Revoked', roles: [], manage: false })
    await assert.rejects(() => f.service.action(guild, support, t.id, 'close', 'No longer permitted'))
  } finally {
    f.close()
  }
})
test('concurrent ticket openings respect per-member limits and invalid forms never reserve a ticket', async () => {
  const f = await ticketFixture()
  try {
    await assert.rejects(() => f.service.open(guild, author, f.panel.id, f.panel.topics[0]!.id, {}))
    assert.equal(f.service.repo.count(guild), 0)
    const values = await Promise.allSettled([
      f.service.open(guild, author, f.panel.id, f.panel.topics[0]!.id, f.answers),
      f.service.open(guild, author, f.panel.id, f.panel.topics[0]!.id, f.answers),
    ])
    assert.equal(values.filter((v) => v.status === 'fulfilled').length, 1)
    assert.equal(f.discord.created, 1)
  } finally {
    f.close()
  }
})
test('saved drafts do not change the published form; revisions prevent concurrent overwrites', async () => {
  const f = await ticketFixture()
  try {
    const changed = {
      ...f.panel,
      title: 'Draft only',
      topics: [{ ...f.panel.topics[0]!, name: 'Draft topic' }],
    }
    await f.service.savePanel(guild, manager, changed, 1)
    assert.equal(
      f.service.opening(guild, f.panel.id, f.panel.topics[0]!.id).topic.name,
      f.panel.topics[0]!.name,
    )
    await assert.rejects(
      () => f.service.savePanel(guild, manager, changed, 1),
      (e: unknown) => e instanceof AppError && e.status === 409,
    )
    await assert.rejects(() => f.service.savePanel(guild, other, changed, 2))
  } finally {
    f.close()
  }
})
test('uncertain publication blocks a second request instead of duplicating a Discord message', async () => {
  const f = await ticketFixture()
  try {
    f.discord.uncertain = true
    await assert.rejects(() => f.service.publish(guild, manager, f.panel.id, randomUUID(), 1))
    await assert.rejects(() => f.service.publish(guild, manager, f.panel.id, randomUUID(), 1))
    assert.equal(f.discord.publications, 2)
  } finally {
    f.close()
  }
})
test('retention expires responses, notes and transcript together without exposing internal notes to authors', async () => {
  const f = await ticketFixture()
  try {
    const t = await f.service.open(guild, author, f.panel.id, f.panel.topics[0]!.id, f.answers)
    await f.service.action(guild, manager, t.id, 'note', 'confidential note')
    await f.service.action(guild, manager, t.id, 'close', 'Resolved')
    f.store.db.prepare('UPDATE tickets SET expires_at=? WHERE id=?').run(Date.now() - 1, t.id)
    f.service.repo.cleanup()
    assert.deepEqual(f.service.repo.get(guild, t.id)?.answers, {})
    assert.deepEqual(f.service.repo.get(guild, t.id)?.notes, [])
    assert.equal(f.service.repo.readTranscript(guild, t.id), null)
    await assert.rejects(() => f.service.transcript(guild, manager, t.id))
  } finally {
    f.close()
  }
})
test('Discord channel overwrites deny public access and block thread writes on close; private thread transfer removes prior assignee', async () => {
  const f = await ticketFixture()
  try {
    const t = await f.service.open(guild, author, f.panel.id, f.panel.topics[0]!.id, f.answers)
    let created: Record<string, unknown> | null = null
    let applied: Array<{ id: string; allow?: bigint[]; deny?: bigint[] }> = []
    const fakeGuild = {
      id: guild,
      roles: { everyone: { id: guild } },
      members: { fetchMe: async () => ({ id: '1900000000000000001' }) },
      channels: {
        fetch: async () => ({ type: ChannelType.GuildCategory, permissionsFor: () => ({ has: () => true }) }),
        create: async (value: Record<string, unknown>) => {
          created = value
          return { id: '1500000000000000001' }
        },
      },
    }
    const gateway = new TicketDiscord(f.discord.client, false, true)
    gateway.guild = async () => fakeGuild as never
    await gateway.create(t)
    const overwrites = (created as unknown as { permissionOverwrites: typeof applied }).permissionOverwrites
    assert.ok(overwrites.find((o) => o.id === guild)?.deny?.includes(P.ViewChannel))
    assert.ok(overwrites.find((o) => o.id === author)?.allow?.includes(P.SendMessages))
    assert.ok(overwrites.find((o) => o.id === role)?.allow?.includes(P.ViewChannel))
    gateway.channel = async () =>
      ({
        isThread: () => false,
        permissionOverwrites: {
          set: async (value: typeof applied) => {
            applied = value
          },
        },
      }) as never
    await gateway.access({ ...t, staffId: support, settings: { ...t.settings, privateOnClaim: true } }, true)
    assert.ok(!applied.some((o) => o.id === role))
    assert.ok(applied.find((o) => o.id === author)?.deny?.includes(P.SendMessagesInThreads))
    assert.ok(applied.find((o) => o.id === author)?.deny?.includes(P.CreatePublicThreads))
    const removed: string[] = []
    gateway.channel = async () =>
      ({
        isThread: () => true,
        archived: false,
        locked: false,
        members: {
          add: async () => {},
          remove: async (id: string) => {
            removed.push(id)
          },
        },
      }) as never
    await gateway.access(
      { ...t, staffId: support, settings: { ...t.settings, privateOnClaim: true } },
      false,
      other,
    )
    assert.deepEqual(removed, [other])
  } finally {
    f.close()
  }
})

test('repeated and concurrent claims are idempotent even with stale revisions and revoked roles remain forbidden', async () => {
  const f = await ticketFixture()
  try {
    const t = await f.service.open(guild, author, f.panel.id, f.panel.topics[0]!.id, f.answers)
    let notices = 0
    f.discord.notice = async () => {
      notices++
    }
    const before = f.discord.accessCalls.length
    const results = await Promise.all(
      Array.from({ length: 8 }, () => f.service.action(guild, support, t.id, 'claim', '', t.revision)),
    )
    assert.ok(results.every((value) => value.revision === results[0]!.revision))
    assert.equal(notices, 1)
    assert.equal(f.discord.accessCalls.length - before, 1)
    assert.equal(f.service.repo.audits(guild).filter((a) => a.action === 'ticket.claim').length, 1)
    assert.equal(ticketControls(results[0]!).toJSON().components[0]!.disabled, true)
    f.discord.people.set(support, { id: support, name: 'Revoked', roles: [], manage: false })
    await assert.rejects(f.service.action(guild, support, t.id, 'claim'), { code: 'forbidden' })
  } finally {
    f.close()
  }
})

test('staff thread locks and archives without an assignee; ticket delete waits for it and interrupted closure can retry', async () => {
  const f = await ticketFixture()
  try {
    const original = await f.service.open(guild, author, f.panel.id, f.panel.topics[0]!.id, f.answers)
    const t = f.service.repo.save({
      ...original,
      staffThreadId: '1700000000000000001',
      settings: { ...original.settings, closeAction: 'delete' },
    })
    const calls: string[] = [],
      gateway = new TicketDiscord(f.discord.client, false, true)
    gateway.guild = async () =>
      ({
        channels: {
          fetch: async () => ({
            isThread: () => true,
            locked: false,
            archived: false,
            setLocked: async (value: boolean) => {
              assert.equal(value, true)
              calls.push('lock')
            },
            setArchived: async (value: boolean) => {
              assert.equal(value, true)
              calls.push('archive')
            },
            members: {
              add: () => {
                throw Error('Must not add members while closing')
              },
            },
          }),
        },
      }) as never
    await gateway.staffThread({ ...t, staffId: null }, true)
    assert.deepEqual(calls, ['lock', 'archive'])
    let fail = true
    f.discord.staffThread = async () => {
      if (fail) {
        fail = false
        throw Error('temporary Discord failure')
      }
      calls.push('staff-closed')
    }
    f.discord.remove = async () => {
      calls.push('ticket-deleted')
    }
    await assert.rejects(f.service.action(guild, manager, t.id, 'close', 'Resolved'), {
      code: 'ticketUncertain',
    })
    assert.equal(f.service.repo.get(guild, t.id)!.status, 'closing')
    const closed = await f.service.action(guild, manager, t.id, 'close', 'Resolved')
    assert.equal(closed.status, 'closed')
    assert.deepEqual(calls.slice(-2), ['staff-closed', 'ticket-deleted'])
    assert.equal(closed.closedBy, manager)
  } finally {
    f.close()
  }
})

test('deleting a ticket channel closes the staff thread without trying to read deleted messages', async () => {
  const f = await ticketFixture()
  try {
    const t = await f.service.open(guild, author, f.panel.id, f.panel.topics[0]!.id, f.answers)
    f.service.repo.save({ ...t, staffThreadId: '1700000000000000001' })
    let closed = false
    f.discord.staffThread = async (_t, close) => {
      closed = close
    }
    f.discord.transcript = async () => {
      throw Error('Deleted channel must not be read')
    }
    await f.service.channelDeleted(guild, t.channelId!)
    assert.equal(closed, true)
    assert.equal(f.service.repo.get(guild, t.id)!.status, 'closed')
    assert.equal(f.service.repo.get(guild, t.id)!.settings.allowReopen, false)
  } finally {
    f.close()
  }
})

test('ticket logs are embeds, preserve original channel names and never ping users', async () => {
  const f = await ticketFixture()
  try {
    const t = await f.service.open(guild, author, f.panel.id, f.panel.topics[0]!.id, f.answers)
    const payload = ticketLogPayload(
      {
        ...t,
        channelName: 'parcerias-0002',
        closedBy: manager,
        closedByName: 'Manager',
        status: 'closed',
        reason: 'Resolved',
        closedAt: Date.now(),
      },
      'Fechado',
    )
    const embed = JSON.parse(JSON.stringify(payload.embeds![0]))
    assert.ok(embed.fields.some((field: { value: string }) => field.value === 'parcerias-0002'))
    assert.ok(embed.fields.some((field: { value: string }) => field.value === 'Resolved'))
    assert.deepEqual(payload.allowedMentions, { parse: [] })
    assert.equal(payload.components!.length, 1)
    assert.equal(ticketControls({ ...t, status: 'closed' }).toJSON().components[0]!.disabled, true)
  } finally {
    f.close()
  }
})

test('DM transcripts send website buttons without files and author access can be revoked', async () => {
  const f = await ticketFixture()
  try {
    const current = f.service.repo.settings(guild)
    await f.service.saveSettings(
      guild,
      manager,
      { ...current.settings, authorTranscript: false, dmTranscript: true },
      current.revision,
    )
    const t = await f.service.open(guild, author, f.panel.id, f.panel.topics[0]!.id, f.answers)
    await assert.rejects(f.service.transcript(guild, author, t.id), { status: 403 })
    const closed = await f.service.action(guild, manager, t.id, 'close', 'Resolved')
    assert.ok((await f.service.transcript(guild, author, t.id)).messages.length)
    await assert.rejects(f.service.transcript(guild, other, t.id), { status: 403 })
    const gateway = new TicketDiscord(f.discord.client, false, true, 'https://bot.example')
    let sent: any
    gateway.client.users.fetch = (async () => ({
      send: async (payload: unknown) => {
        sent = payload
      },
    })) as never
    await gateway.dm(closed, await f.service.transcript(guild, manager, t.id))
    assert.equal(sent.files, undefined)
    const button = sent.components[0].toJSON().components[0]
    assert.equal(button.style, 5)
    assert.equal(button.url, `https://bot.example/transcripts/${guild}/${t.id}`)
    const settings = f.service.repo.settings(guild)
    await f.service.saveSettings(
      guild,
      manager,
      { ...settings.settings, dmTranscript: false },
      settings.revision,
    )
    await assert.rejects(f.service.transcript(guild, author, t.id), { status: 403 })
  } finally {
    f.close()
  }
})

test('Discord transcript action returns a website button only after authorization', async () => {
  const f = await ticketFixture()
  try {
    const t = await f.service.open(guild, author, f.panel.id, f.panel.topics[0]!.id, f.answers)
    const replies: any[] = []
    const interaction = {
      guildId: guild,
      user: { id: support },
      customId: `ticket:transcript:${t.id}`,
      isButton: () => true,
      isStringSelectMenu: () => false,
      isModalSubmit: () => false,
      deferred: true,
      deferReply: async () => {},
      editReply: async (p: unknown) => {
        replies.push(p)
      },
    }
    await ticketInteractionHandler(f.service).handle(interaction as never)
    assert.equal(replies[0].files, undefined)
    assert.equal(
      replies[0].components[0].toJSON().components[0].url,
      `https://bot.example/transcripts/${guild}/${t.id}`,
    )
    interaction.user.id = other
    await ticketInteractionHandler(f.service).handle(interaction as never)
    assert.equal(replies[1].components, undefined)
    assert.equal(replies[1].files, undefined)
  } finally {
    f.close()
  }
})
