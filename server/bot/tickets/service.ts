import type { Store } from '../../store.js'
import { AppError } from '../../security.js'
import { TicketRepository } from '../../tickets/repository.js'
import {
  panelSchema,
  ticketSettingsSchema,
  type TicketPanel,
  type TicketRecord,
  type TicketSettings,
} from '../../../shared/tickets.js'
import { tt } from '../../../shared/ticket-i18n.js'
import { TicketDiscord, type TicketActor } from './discord.js'
export class TicketService {
  readonly repo: TicketRepository
  constructor(
    readonly store: Store,
    readonly discord: TicketDiscord,
    key: string,
  ) {
    this.repo = new TicketRepository(store.db, key)
  }
  private manager(actor: TicketActor, settings: TicketSettings) {
    return actor.manage || settings.managerRoleIds.some((r) => actor.roles.includes(r))
  }
  async manage(guild: string, user: string) {
    const actor = await this.discord.actor(guild, user)
    if (!this.manager(actor, this.repo.settings(guild).settings)) throw new AppError(403, 'forbidden')
    return actor
  }
  private async staff(t: TicketRecord, user: string) {
    const actor = await this.discord.actor(t.guildId, user),
      manager = this.manager(actor, this.repo.settings(t.guildId).settings)
    const roles = t.topic.supportRoleIds.length ? t.topic.supportRoleIds : t.settings.supportRoleIds
    if (
      !manager &&
      (!roles.some((r) => actor.roles.includes(r)) ||
        (t.settings.privateOnClaim && !!t.staffId && t.staffId !== user))
    )
      throw new AppError(403, 'forbidden')
    return { actor, manager }
  }
  private record(guild: string, id: string) {
    const t = this.repo.get(guild, id)
    if (!t) throw new AppError(404, 'notFound')
    return t
  }
  async context(guild: string, user: string) {
    await this.manage(guild, user)
    this.repo.cleanup()
    return {
      ...this.repo.settings(guild),
      panels: this.repo.panels(guild),
      templates: this.repo.templates(guild),
      resources: await this.discord.resources(guild, user),
      demo: this.discord.demo,
      contentEnabled: this.discord.contentEnabled,
    }
  }
  async saveSettings(guild: string, user: string, input: unknown, revision: number) {
    await this.manage(guild, user)
    const settings = ticketSettingsSchema.parse(input)
    await this.discord.validate(guild, undefined, settings, user)
    return this.store.withGuildLock(guild, async () =>
      this.repo.saveSettings(guild, settings, revision, user),
    )
  }
  async savePanel(guild: string, user: string, input: unknown, revision: number) {
    await this.manage(guild, user)
    const panel = panelSchema.parse(input)
    await this.discord.validate(guild, panel, this.repo.settings(guild).settings, user)
    return this.store.withGuildLock(guild, async () => {
      if (this.repo.pendingPublish(guild, panel.id)) throw new AppError(409, 'ticketUncertain')
      if (!this.repo.panel(guild, panel.id) && this.repo.panels(guild).length >= 50)
        throw new AppError(400, 'invalidInput')
      return this.repo.savePanel(guild, panel, revision, user)
    })
  }
  async template(guild: string, user: string, input: unknown) {
    await this.manage(guild, user)
    return this.repo.template(guild, panelSchema.parse(input), user)
  }
  async deleteTemplate(guild: string, user: string, id: string) {
    await this.manage(guild, user)
    this.repo.deleteTemplate(guild, id, user)
    return { ok: true }
  }
  async deletePanel(guild: string, user: string, id: string) {
    await this.manage(guild, user)
    return this.store.withGuildLock(guild, async () => {
      this.repo.deletePanel(guild, id, user)
      return { ok: true }
    })
  }
  async publish(guild: string, user: string, id: string, requestId: string, revision: number) {
    await this.manage(guild, user)
    return this.store.withGuildLock(guild, async () => {
      const view = this.repo.panel(guild, id)
      if (!view || view.revision !== revision) throw new AppError(409, 'revisionConflict')
      const settings = this.repo.settings(guild).settings
      await this.discord.validate(guild, view.panel, settings, user)
      if (
        !view.panel.channelId ||
        ((view.panel.topics.some((t) => t.style === 'thread' || t.staffThread) || settings.staffThread) &&
          !settings.logChannelId) ||
        view.panel.topics.some((t) =>
          t.style === 'channel'
            ? !(t.categoryId || settings.categoryId)
            : !(t.threadParentId || settings.threadParentId),
        )
      )
        throw new AppError(400, 'ticketNotConfigured')
      const previous = this.repo.beginPublish(guild, requestId, id)
      if (previous) return previous
      try {
        const result = await this.discord.publish(
          guild,
          view.panel,
          view.messageId,
          view.publishedChannelId,
          requestId,
          settings.locale,
          user,
        )
        this.repo.published(guild, view.panel, result.id, result.channelId, user)
        this.repo.finishPublish(guild, requestId, result)
        return result
      } catch (e) {
        if (e instanceof AppError && e.status < 500) this.repo.cancelPublish(guild, requestId)
        this.repo.audit(guild, user, 'panel.publish_uncertain', id)
        throw e
      }
    })
  }
  async reconcilePanel(guild: string, user: string, id: string, messageId: string | null) {
    await this.manage(guild, user)
    return this.store.withGuildLock(guild, async () => {
      const pending = this.repo.pendingPublish(guild, id),
        view = this.repo.panel(guild, id)
      if (!pending || !view || Date.now() - pending.at < 30000) throw new AppError(409, 'ticketUncertain')
      if (messageId) {
        const result = await this.discord.adoptPanel(guild, view.panel, messageId, user)
        this.repo.published(guild, view.panel, result.id, result.channelId, user)
        this.repo.finishPublish(guild, pending.request_id, result)
      } else this.repo.cancelPublish(guild, pending.request_id)
      this.repo.audit(guild, user, 'panel.reconciled', id)
      return { ok: true }
    })
  }
  opening(guild: string, panelId: string, topicId: string) {
    const view = this.repo.panel(guild, panelId, true),
      topic = view?.panel.topics.find((t) => t.id === topicId)
    if (!view || !topic) throw new AppError(404, 'notFound')
    return { panel: view.panel, topic, revision: view.revision }
  }
  async open(
    guild: string,
    user: string,
    panelId: string,
    topicId: string,
    answers: Record<string, string>,
    revision?: number,
  ) {
    return this.store.withGuildLock(guild, async () => {
      const actor = await this.discord.actor(guild, user),
        { panel, topic, revision: current } = this.opening(guild, panelId, topicId)
      if (revision !== undefined && current !== revision) throw new AppError(409, 'revisionConflict')
      if (
        Object.keys(answers).some((id) => !topic.questions.some((q) => q.id === id)) ||
        topic.questions.some(
          (q) => (q.required && !answers[q.id]?.trim()) || (answers[q.id]?.length ?? 0) > q.maxLength,
        )
      )
        throw new AppError(400, 'invalidInput')
      const settings = this.repo.settings(guild).settings
      let t = this.repo.reserve(
        guild,
        { id: user, name: actor.name },
        panel,
        structuredClone(topic),
        answers,
        settings,
      )
      try {
        const created = await this.discord.create(t)
        t = this.repo.save({ ...t, ...created })
        await this.discord.welcome(t)
        t = this.repo.save({ ...t, status: 'open' })
        this.repo.audit(guild, user, 'ticket.opened', t.id)
        await this.safeLog(t, 'Aberto')
        return t
      } catch (e) {
        this.repo.save({ ...t, status: 'error' })
        this.repo.audit(guild, user, 'ticket.open_uncertain', t.id)
        throw e
      }
    })
  }
  async list(guild: string, user: string, offset = 0) {
    await this.manage(guild, user)
    this.repo.cleanup()
    const records = this.repo.list(guild, 100, offset)
    return {
      tickets: records.map(({ answers, notes, settings, ...t }) => ({ ...t, noteCount: notes.length })),
      total: this.repo.count(guild),
      active: this.repo.active(guild).map((t) => ({ status: t.status })),
      offset,
      audit: this.repo.audits(guild),
    }
  }
  async detail(guild: string, user: string, id: string) {
    const t = this.record(guild, id)
    await this.staff(t, user)
    return { ticket: t, transcript: this.repo.readTranscript(guild, id) }
  }
  async action(
    guild: string,
    user: string,
    id: string,
    action: 'claim' | 'transfer' | 'close' | 'reopen' | 'note' | 'recover',
    value = '',
    revision?: number,
  ) {
    return this.store.withGuildLock(guild, async () => {
      let t = this.record(guild, id)
      const { manager } = await this.staff(t, user)
      if (revision !== undefined && t.revision !== revision) throw new AppError(409, 'revisionConflict')
      if (action === 'recover') {
        if (!manager || !['creating', 'error'].includes(t.status) || Date.now() - t.createdAt < 120000)
          throw new AppError(409, 'ticketUncertain')
        const channel = t.channelId || (await this.discord.recover(t))
        if (channel) {
          await this.discord.access({ ...t, channelId: channel })
          t = this.repo.save({ ...t, channelId: channel, status: 'open' })
        } else if (value === 'cancel')
          t = this.repo.save({
            ...t,
            status: 'closed',
            closedAt: Date.now(),
            settings: { ...t.settings, allowReopen: false },
            reason: 'Cancelled after operator verification',
          })
        else throw new AppError(409, 'ticketUncertain')
        this.repo.audit(guild, user, 'ticket.reconciled', id)
        return t
      }
      if (action === 'note') {
        if (!value.trim() || value.length > 2000 || t.notes.length >= 100)
          throw new AppError(400, 'invalidInput')
        t = this.repo.save({ ...t, notes: [...t.notes, { actor: user, at: Date.now(), text: value.trim() }] })
      } else if (action === 'claim' || action === 'transfer') {
        if (!['open', 'progress'].includes(t.status)) throw new AppError(409, 'invalidInput')
        const staffId = action === 'claim' ? user : value
        if (action === 'transfer') {
          if (!/^\d{17,20}$/.test(staffId)) throw new AppError(400, 'invalidInput')
          await this.staff({ ...t, staffId: null }, staffId)
        }
        if (t.staffId && t.staffId !== user && action === 'claim' && !manager)
          throw new AppError(403, 'forbidden')
        const next = { ...t, staffId, status: 'progress' as const }
        await this.discord.access(next, false, t.staffId)
        t = this.repo.save(next)
        if (t.settings.pingOnClaim)
          await this.discord
            .notice(t, tt(t.settings.locale, 'Responsável') + ': {{staff}}', true)
            .catch(() => {})
      } else if (action === 'close') return this.closeRecord(t, user, value)
      else {
        if (
          t.status !== 'closed' ||
          !t.settings.allowReopen ||
          t.settings.closeAction === 'delete' ||
          !t.channelId
        )
          throw new AppError(409, 'invalidInput')
        const active = this.repo.active(guild)
        if (
          active.length >= t.settings.maxActive ||
          active.filter((x) => x.authorId === t.authorId).length >= t.settings.maxPerUser
        )
          throw new AppError(409, 'ticketLimit')
        await this.discord.access({ ...t, status: 'open' })
        this.repo.clearTranscript(t.id)
        t = this.repo.save({ ...t, status: 'open', closedAt: null, reason: '', lastActivity: Date.now() })
        await this.discord.notice(t, tt(t.settings.locale, 'Reabrir ticket')).catch(() => {})
      }
      this.repo.audit(guild, user, 'ticket.' + action, id)
      return t
    })
  }
  private async closeRecord(t: TicketRecord, user: string, reason: string) {
    if (t.status === 'closed') return t
    if (!['open', 'progress', 'closing'].includes(t.status)) throw new AppError(409, 'ticketUncertain')
    if ((t.settings.requireCloseReason && !reason.trim()) || reason.length > 1000)
      throw new AppError(400, 'invalidInput')
    let snapshot = t.status === 'closing' ? this.repo.readTranscript(t.guildId, t.id) : null
    if (!snapshot) snapshot = await this.discord.transcript(t)
    if (t.settings.retentionDays > 0) this.repo.transcript(t, snapshot)
    if (t.status !== 'closing') t = this.repo.save({ ...t, status: 'closing', reason })
    try {
      await this.discord
        .notice(t, t.settings.closedMessage || tt(t.settings.locale, 'Encerrar ticket'))
        .catch(() => {})
      if (t.settings.closeAction === 'delete') await this.discord.remove(t)
      else await this.discord.access(t, true)
    } catch (e) {
      if (!(e instanceof AppError && e.status === 404 && t.settings.closeAction === 'delete')) {
        this.repo.audit(t.guildId, user, 'ticket.close_uncertain', t.id)
        throw new AppError(409, 'ticketUncertain')
      }
    }
    t = this.repo.save({ ...t, status: 'closed', reason, closedAt: Date.now() })
    this.repo.audit(t.guildId, user, 'ticket.closed', t.id)
    if (t.settings.dmTranscript)
      await this.discord
        .dm(t, snapshot)
        .catch(() => this.repo.audit(t.guildId, user, 'ticket.dm_failed', t.id))
    await this.safeLog(t, 'Fechado')
    this.repo.cleanup()
    return t
  }
  async transcript(guild: string, user: string, id: string) {
    const t = this.record(guild, id)
    if (t.authorId === user && this.repo.settings(guild).settings.authorTranscript)
      await this.discord.actor(guild, user)
    else await this.staff(t, user)
    const stored = this.repo.readTranscript(guild, id)
    if (stored) return stored
    if (t.status === 'open' || t.status === 'progress') return this.discord.transcript(t)
    throw new AppError(410, 'ticketTranscriptExpired')
  }
  async requestClose(guild: string, user: string, id: string) {
    const t = this.record(guild, id)
    if (t.authorId !== user) throw new AppError(403, 'forbidden')
    await this.discord.actor(guild, user)
    if (!['open', 'progress'].includes(t.status)) throw new AppError(409, 'invalidInput')
    await this.safeLog(t, 'Solicitar encerramento')
    this.repo.audit(guild, user, 'ticket.close_requested', id)
    await this.discord.notice(t, tt(t.settings.locale, 'Solicitar encerramento')).catch(() => {})
    return { ok: true }
  }
  private async safeLog(t: TicketRecord, label: string) {
    try {
      await this.discord.log(t, tt(t.settings.locale, label))
    } catch {
      this.repo.audit(t.guildId, this.discord.client.user?.id ?? 'system', 'log.failed', t.id)
    }
  }
  async maintenance() {
    this.repo.cleanup()
    if (!this.discord.demo && !this.discord.client.isReady()) return
    for (const guild of this.repo.guilds()) {
      const eligible = this.repo
        .active(guild)
        .filter(
          (t) =>
            ((t.status === 'creating' || t.status === 'error') && t.createdAt < Date.now() - 120000) ||
            t.status === 'closing' ||
            (['open', 'progress'].includes(t.status) &&
              t.settings.inactivityHours &&
              Date.now() - t.lastActivity > t.settings.inactivityHours * 3600000),
        )
        .sort((a, b) => a.lastActivity - b.lastActivity)
        .slice(0, 5)
      for (const candidate of eligible)
        await this.store.withGuildLock(guild, async () => {
          let t = this.record(guild, candidate.id)
          try {
            if ((t.status === 'creating' || t.status === 'error') && t.createdAt < Date.now() - 120000) {
              const channel = t.channelId || (await this.discord.recover(t))
              if (channel) {
                await this.discord.access({ ...t, channelId: channel })
                t = this.repo.save({ ...t, channelId: channel, status: 'open' })
                this.repo.audit(guild, 'system', 'ticket.recovered', t.id)
              }
            }
            if (t.status === 'closing') await this.closeRecord(t, 'system', t.reason || 'Recovery')
            if (
              ['open', 'progress'].includes(t.status) &&
              t.settings.inactivityHours &&
              Date.now() - t.lastActivity > t.settings.inactivityHours * 3600000
            )
              await this.closeRecord(t, 'system', 'Inactivity')
          } catch {
            this.repo.audit(guild, 'system', 'maintenance.failed', t.id)
          }
        })
    }
  }
  async channelDeleted(guild: string, channel: string) {
    await this.store.withGuildLock(guild, async () => {
      const t = this.repo.byChannel(guild, channel)
      if (t && t.status !== 'closed') {
        this.repo.save({
          ...t,
          status: 'closed',
          closedAt: Date.now(),
          reason: 'Channel deleted in Discord',
          settings: { ...t.settings, allowReopen: false },
        })
        this.repo.audit(guild, 'system', 'ticket.channel_deleted', t.id)
      }
    })
  }
}
