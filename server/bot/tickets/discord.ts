import {
  ChannelType,
  PermissionFlagsBits as P,
  AttachmentBuilder,
  escapeMarkdown,
  type Client,
  type TextChannel,
  type ThreadChannel,
  type Guild,
  type GuildMember,
  type OverwriteResolvable,
  type MessageCreateOptions,
} from 'discord.js'
import type {
  TicketRecord,
  TicketSettings,
  TicketPanel,
  TicketResources,
  Transcript,
} from '../../../shared/tickets.js'
import { ticketVariables } from '../../../shared/tickets.js'
import { tt } from '../../../shared/ticket-i18n.js'
import { displayAnswer } from '../../../shared/ticket-forms.js'
import { documentFor, renderTranscript } from '../../tickets/transcript.js'
import { AppError } from '../../security.js'
import { panelPayload, ticketControls, ticketLogPayload } from './messages.js'
export interface TicketActor {
  id: string
  name: string
  roles: string[]
  manage: boolean
}
export class TicketDiscord {
  constructor(
    readonly client: Client,
    readonly demo: boolean,
    readonly contentEnabled: boolean,
    readonly appUrl = '',
  ) {}
  async guild(id: string) {
    const g = this.client.guilds.cache.get(id)
    if (!g || !this.client.isReady()) throw new AppError(409, 'notInstalled')
    return g
  }
  async actor(guild: string, id: string): Promise<TicketActor> {
    if (this.demo) return { id, name: 'Hanami', roles: ['1400000000000000001'], manage: true }
    const member = await (await this.guild(guild)).members.fetch({ user: id, force: true }).catch(() => {
      throw new AppError(403, 'forbidden')
    })
    return {
      id,
      name: member.displayName,
      roles: [...member.roles.cache.keys()],
      manage: member.permissions.has(P.ManageGuild),
    }
  }
  async resources(id: string, actorId?: string): Promise<TicketResources> {
    if (this.demo)
      return {
        channels: [
          { id: '1200000000000000001', name: 'abra-um-ticket' },
          { id: '1200000000000000002', name: 'logs-equipe' },
        ],
        categories: [{ id: '1300000000000000001', name: 'Suporte' }],
        roles: [
          { id: '1400000000000000001', name: 'Suporte' },
          { id: '1400000000000000002', name: 'Gestão' },
        ],
      }
    const g = await this.guild(id)
    const [channels, roles] = await Promise.all([g.channels.fetch(), g.roles.fetch()])
    const actor = actorId ? await g.members.fetch({ user: actorId, force: true }) : null
    const visible = (c: import('discord.js').GuildBasedChannel | null) =>
      !!c && (!actor || c.permissionsFor(actor)?.has(P.ViewChannel))
    return {
      channels: [...channels.values()]
        .filter((c) => c?.type === ChannelType.GuildText && visible(c))
        .map((c) => ({ id: c!.id, name: c!.name })),
      categories: [...channels.values()]
        .filter((c) => c?.type === ChannelType.GuildCategory && visible(c))
        .map((c) => ({ id: c!.id, name: c!.name })),
      roles: [...roles.values()]
        .filter((r) => r.id !== id && !r.managed)
        .map((r) => ({ id: r.id, name: r.name })),
    }
  }
  async validate(guild: string, panel: TicketPanel | undefined, settings: TicketSettings, actorId?: string) {
    const r = await this.resources(guild, actorId)
    const valid = (ids: string[], set: { id: string }[]) =>
      ids.every((id) => !id || set.some((v) => v.id === id))
    if (
      !valid([...settings.supportRoleIds, ...settings.managerRoleIds], r.roles) ||
      !valid([settings.categoryId], r.categories) ||
      !valid([settings.threadParentId, settings.logChannelId], r.channels)
    )
      throw new AppError(400, 'invalidInput')
    if (
      panel &&
      (!valid([panel.channelId], r.channels) ||
        panel.topics.some(
          (t) =>
            !valid(t.supportRoleIds, r.roles) ||
            !valid([t.categoryId], r.categories) ||
            !valid([t.threadParentId], r.channels),
        ))
    )
      throw new AppError(400, 'invalidInput')
    if (settings.logChannelId && !this.demo) {
      const g = await this.guild(guild)
      const c = await g.channels.fetch(settings.logChannelId)
      if (!c || !('permissionsFor' in c) || c.permissionsFor(g.roles.everyone)?.has(P.ViewChannel))
        throw new AppError(400, 'ticketPrivateLog')
      const roles = await g.roles.fetch(),
        allowed = new Set([...settings.supportRoleIds, ...settings.managerRoleIds])
      for (const role of roles.values())
        if (
          role.id !== g.id &&
          !role.permissions.has([P.Administrator]) &&
          !role.permissions.has(P.ManageGuild) &&
          !allowed.has(role.id) &&
          c.permissionsFor(role)?.has(P.ViewChannel)
        )
          throw new AppError(400, 'ticketPrivateLog')
    }
  }
  async publish(
    guild: string,
    panel: TicketPanel,
    messageId: string | null,
    oldChannel: string | null,
    request: string,
    locale: string,
    actorId?: string,
  ) {
    if (this.demo) return { id: request, channelId: panel.channelId, demo: true }
    const g = await this.guild(guild)
    const c = await g.channels.fetch(panel.channelId)
    if (c?.type !== ChannelType.GuildText) throw new AppError(400, 'invalidInput')
    const me = await g.members.fetchMe({ force: true })
    const actor = actorId ? await g.members.fetch({ user: actorId, force: true }) : null
    if (actor && !c.permissionsFor(actor)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks]))
      throw new AppError(403, 'forbidden')
    if (!c.permissionsFor(me)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks]))
      throw new AppError(403, 'forbidden')
    const payload = panelPayload(panel, locale)
    if (messageId && oldChannel === c.id) {
      const m = await c.messages.fetch(messageId)
      if (m.author.id !== this.client.user!.id) throw new AppError(403, 'forbidden')
      if (!!(m.flags.bitfield & 32768) !== (panel.format === 'v2'))
        throw new AppError(409, 'ticketFormatChange')
      await m.edit({ ...payload, embeds: panel.format === 'v2' ? undefined : payload.embeds } as Parameters<
        typeof m.edit
      >[0])
      return { id: m.id, channelId: c.id, demo: false }
    }
    const m = await c.send({ ...payload, nonce: request.replace(/-/g, '').slice(0, 25), enforceNonce: true })
    return { id: m.id, channelId: c.id, demo: false }
  }
  private overwrites(g: Guild, t: TicketRecord, botId: string, closed = false): OverwriteResolvable[] {
    const roles =
      t.settings.privateOnClaim && t.staffId
        ? []
        : t.topic.supportRoleIds.length
          ? t.topic.supportRoleIds
          : t.settings.supportRoleIds
    const ids = [...new Set([...roles, ...t.settings.managerRoleIds])].filter((id) => id !== g.id)
    const access = closed
      ? [P.ViewChannel, P.ReadMessageHistory]
      : [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.AttachFiles, P.EmbedLinks]
    const deny = closed
      ? [
          P.SendMessages,
          P.CreatePublicThreads,
          P.CreatePrivateThreads,
          P.SendMessagesInThreads,
          P.AddReactions,
        ]
      : []
    const rows: OverwriteResolvable[] = [
      { id: g.id, deny: [P.ViewChannel] },
      ...ids.map((id) => ({
        id,
        allow: access,
        deny: closed
          ? [
              P.SendMessages,
              P.CreatePublicThreads,
              P.CreatePrivateThreads,
              P.SendMessagesInThreads,
              P.AddReactions,
            ]
          : [],
      })),
      { id: t.authorId, allow: access, deny },
      {
        id: botId,
        allow: [
          P.ViewChannel,
          P.ReadMessageHistory,
          P.SendMessages,
          P.ManageChannels,
          P.ManageThreads,
          P.CreatePrivateThreads,
          P.SendMessagesInThreads,
          P.AttachFiles,
          P.EmbedLinks,
        ],
      },
    ]
    if (t.staffId && t.staffId !== t.authorId && t.staffId !== botId)
      rows.push({ id: t.staffId, allow: access, deny })
    return rows
  }
  async create(
    t: TicketRecord,
  ): Promise<{ channelId: string; staffThreadId: string | null; channelName?: string; guildName?: string }> {
    if (this.demo)
      return { channelId: Math.floor(1e17 + Math.random() * 1e17).toFixed(), staffThreadId: null }
    const g = await this.guild(t.guildId),
      me = await g.members.fetchMe({ force: true })
    const name =
      ticketVariables(t.settings.namePattern, {
        number: t.number,
        topic: t.topic.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      })
        .replace(/[^a-z0-9-]/g, '-')
        .slice(0, 90) || `ticket-${t.number}`
    let c: TextChannel | ThreadChannel
    if (t.topic.style === 'thread') {
      const parent = await g.channels.fetch(t.topic.threadParentId || t.settings.threadParentId)
      const author = await g.members.fetch(t.authorId)
      if (
        parent?.type !== ChannelType.GuildText ||
        !parent.permissionsFor(author)?.has(P.ViewChannel) ||
        !parent
          .permissionsFor(me)
          ?.has([P.ViewChannel, P.CreatePrivateThreads, P.ManageThreads, P.SendMessagesInThreads])
      )
        throw new AppError(403, 'forbidden')
      c = await parent.threads.create({
        name: (name + '-' + t.id.slice(0, 8)).slice(0, 100),
        type: ChannelType.PrivateThread,
        invitable: false,
        reason: `Branilist ticket ${t.id}`,
      })
      await c.members.add(t.authorId)
    } else {
      const category = t.topic.categoryId || t.settings.categoryId
      const p = await g.channels.fetch(category)
      if (
        p?.type !== ChannelType.GuildCategory ||
        !p.permissionsFor(me)?.has([P.ViewChannel, P.ManageChannels])
      )
        throw new AppError(403, 'forbidden')
      c = await g.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: category,
        topic: `branilist-ticket:${t.id}`,
        permissionOverwrites: this.overwrites(g, t, me.id),
        reason: `Branilist ticket ${t.id}`,
      })
    }
    return { channelId: c.id, staffThreadId: null, channelName: c.name, guildName: g.name }
  }
  async channel(t: TicketRecord): Promise<TextChannel | ThreadChannel> {
    if (!t.channelId) throw new AppError(409, 'ticketUncertain')
    const c = await (await this.guild(t.guildId)).channels.fetch(t.channelId).catch((e: unknown) => {
      if (e && typeof e === 'object' && 'code' in e && e.code === 10003) throw new AppError(404, 'notFound')
      throw e
    })
    if (!c || (c.type !== ChannelType.GuildText && !c.isThread())) throw new AppError(404, 'notFound')
    return c as TextChannel | ThreadChannel
  }
  async welcome(t: TicketRecord) {
    if (this.demo) return
    const g = await this.guild(t.guildId),
      c = await this.channel(t)
    const welcome = ticketVariables(t.topic.welcome || '{{user}}', {
      user: escapeMarkdown(t.authorName),
      server: escapeMarkdown(g.name),
      ticketId: t.number,
      topic: escapeMarkdown(t.topic.name),
      number: t.number,
    })
    const roles = t.topic.supportRoleIds.length ? t.topic.supportRoleIds : t.settings.supportRoleIds
    const ping = t.topic.pingSupport || t.settings.pingSupport
    const welcomeMessage = await c.send({
      content:
        `**#${t.number} • ${escapeMarkdown(t.topic.name)}**\n${welcome}${ping ? '\n' + roles.map((r) => `<@&${r}>`).join(' ') : ''}`.slice(
          0,
          1900,
        ),
      components: [ticketControls(t)],
      allowedMentions: { parse: [], roles: ping ? roles : [] },
    })
    ;(t.controlMessages ??= []).push({ channelId: c.id, messageId: welcomeMessage.id, kind: 'welcome' })
    for (const q of t.topic.questions) {
      const raw = t.answers[q.id]
      const answer =
        q.style === 'checkbox'
          ? tt(t.settings.locale, raw === 'true' ? 'Sim' : 'Não')
          : displayAnswer(q, raw ?? '')
      if (answer)
        await c.send({
          content: `**${escapeMarkdown(q.label)}**\n${answer}`.slice(0, 2000),
          allowedMentions: { parse: [] },
        })
    }
    if (t.topic.staffThread || t.settings.staffThread) {
      const parent = await g.channels.fetch(t.settings.logChannelId)
      if (
        parent?.type !== ChannelType.GuildText ||
        parent.permissionsFor(g.roles.everyone)?.has(P.ViewChannel)
      )
        throw new AppError(400, 'ticketPrivateLog')
      const thread = await parent.threads.create({
        name: `staff-${t.number}`,
        type: ChannelType.PrivateThread,
        invitable: false,
        reason: 'Private ticket staff notes',
      })
      t.staffThreadId = thread.id
    }
  }
  async access(t: TicketRecord, closed = false, previousStaffId?: string | null) {
    if (this.demo) return
    const c = await this.channel(t)
    if (c.isThread()) {
      if (!closed && c.archived) await c.setArchived(false)
      if (closed) {
        await c.setLocked(true)
        await c.setArchived(true)
      } else {
        if (c.locked) await c.setLocked(false)
        await c.members.add(t.authorId)
        if (t.staffId) await c.members.add(t.staffId)
        if (
          t.settings.privateOnClaim &&
          previousStaffId &&
          previousStaffId !== t.staffId &&
          previousStaffId !== t.authorId
        )
          await c.members.remove(previousStaffId)
      }
    } else {
      const g = await this.guild(t.guildId),
        me = await g.members.fetchMe({ force: true })
      await (c as TextChannel).permissionOverwrites.set(
        this.overwrites(g, t, me.id, closed),
        'Ticket access updated',
      )
    }
    if (!closed) await this.staffThread(t, false, previousStaffId)
  }
  async staffThread(t: TicketRecord, closed: boolean, previousStaffId?: string | null) {
    if (this.demo || !t.staffThreadId) return
    const thread = await (await this.guild(t.guildId)).channels.fetch(t.staffThreadId).catch((e: unknown) => {
      if (e && typeof e === 'object' && 'code' in e && e.code === 10003) return null
      throw e
    })
    if (!thread?.isThread()) return
    if (closed) {
      if (!thread.locked) await thread.setLocked(true)
      if (!thread.archived) await thread.setArchived(true)
    } else {
      if (thread.archived) await thread.setArchived(false)
      if (thread.locked) await thread.setLocked(false)
      if (t.staffId) await thread.members.add(t.staffId)
      if (t.settings.privateOnClaim && previousStaffId && previousStaffId !== t.staffId)
        await thread.members.remove(previousStaffId)
    }
  }
  async refreshControls(t: TicketRecord) {
    if (this.demo) return
    for (const ref of t.controlMessages ?? []) {
      try {
        const channel = await (await this.guild(t.guildId)).channels.fetch(ref.channelId)
        if (channel?.isTextBased() && 'messages' in channel) {
          const message = await channel.messages.fetch(ref.messageId)
          await message.edit(
            ref.kind === 'log' && t.status !== 'closed'
              ? ticketLogPayload(t, tt(t.settings.locale, 'Aberto'))
              : { components: [ticketControls(t)] },
          )
        }
      } catch {
        /* Old/deleted control messages do not block the ticket lifecycle. */
      }
    }
  }
  async transcript(t: TicketRecord): Promise<Transcript> {
    const value: Transcript = {
      messages: [],
      truncated: false,
      contentAvailable: this.contentEnabled,
      capturedAt: Date.now(),
    }
    if (this.demo) {
      value.messages = [
        {
          id: 'demo',
          author: t.authorName,
          authorId: t.authorId,
          at: t.createdAt,
          content: 'Conversa de demonstração.',
          attachments: [],
        },
      ]
      return value
    }
    const c = await this.channel(t)
    let before: string | undefined
    t.channelName ||= c.name
    t.guildName ||= c.guild.name
    for (let page = 0; page < 50; page++) {
      const chunk = await c.messages.fetch({ limit: 100, before })
      for (const m of chunk.values())
        value.messages.push({
          id: m.id,
          author: m.member?.displayName || m.author.globalName || m.author.username,
          avatar: m.author.displayAvatarURL({ size: 64, extension: 'png' }),
          bot: m.author.bot,
          editedAt: m.editedTimestamp,
          files: [...m.attachments.values()].map((a) => ({ url: a.url, name: a.name, size: a.size })),
          embeds: m.embeds.map((e) => ({
            title: e.title ?? undefined,
            description: e.description ?? undefined,
            color: e.color ?? undefined,
            fields: e.fields,
            footer: e.footer?.text,
          })),
          authorId: m.author.id,
          at: m.createdTimestamp,
          content: m.content,
          attachments: [...m.attachments.values()].map((a) => a.url),
        })
      if (chunk.size < 100) {
        value.messages.reverse()
        return value
      }
      before = chunk.last()!.id
    }
    value.truncated = true
    value.messages.reverse()
    return value
  }
  async log(t: TicketRecord, action: string) {
    if (this.demo || !t.settings.logChannelId) return
    const g = await this.guild(t.guildId),
      c = await g.channels.fetch(t.settings.logChannelId)
    if (c?.type !== ChannelType.GuildText || c.permissionsFor(g.roles.everyone)?.has(P.ViewChannel)) return
    const message = await c.send(ticketLogPayload(t, action))
    if (t.status === 'open')
      (t.controlMessages ??= []).push({ channelId: c.id, messageId: message.id, kind: 'log' })
  }

  async notice(t: TicketRecord, text: string, ping = false) {
    if (this.demo) return
    await (
      await this.channel(t)
    ).send({
      content:
        ticketVariables(text, {
          user: escapeMarkdown(t.authorName),
          staff: t.staffId ? `<@${t.staffId}>` : '—',
          server: (await this.guild(t.guildId)).name,
          ticketId: t.number,
          number: t.number,
          topic: escapeMarkdown(t.topic.name),
        }) + (ping ? `\n<@${t.authorId}>` : ''),
      allowedMentions: { parse: [], users: ping ? [t.authorId] : [] },
    })
  }
  async remove(t: TicketRecord) {
    if (!this.demo) await (await this.channel(t)).delete('Ticket closed after transcript')
  }
  async dm(t: TicketRecord, transcript: Transcript) {
    if (this.demo) return
    const user = await this.client.users.fetch(t.authorId)
    await user.send({
      content: `${tt(t.settings.locale, 'Transcrição')} #${t.number}`,
      files: [
        new AttachmentBuilder(Buffer.from(renderTranscript(documentFor(t, transcript)).html), {
          name: `ticket-${t.number}.html`,
        }),
      ],
      allowedMentions: { parse: [] },
    })
  }
  async recover(t: TicketRecord) {
    if (this.demo) return null
    if (t.topic.style === 'thread') {
      const threads = await (await this.guild(t.guildId)).channels.fetchActiveThreads()
      return [...threads.threads.values()].find((c) => c.name.endsWith('-' + t.id.slice(0, 8)))?.id ?? null
    }
    const channels = await (await this.guild(t.guildId)).channels.fetch()
    return (
      [...channels.values()].find(
        (c) => c?.type === ChannelType.GuildText && c.topic === `branilist-ticket:${t.id}`,
      )?.id ?? null
    )
  }
  async adoptPanel(guild: string, panel: TicketPanel, messageId: string, user: string) {
    if (this.demo) return { id: messageId, channelId: panel.channelId, demo: true }
    const g = await this.guild(guild),
      c = await g.channels.fetch(panel.channelId),
      actor = await g.members.fetch({ user, force: true })
    if (c?.type !== ChannelType.GuildText || !c.permissionsFor(actor)?.has(P.ViewChannel))
      throw new AppError(403, 'forbidden')
    const m = await c.messages.fetch(messageId)
    if (
      m.author.id !== this.client.user!.id ||
      !JSON.stringify(m.components).includes(`ticket:open:${panel.id}`)
    )
      throw new AppError(400, 'invalidInput')
    return { id: m.id, channelId: c.id, demo: false }
  }
}
