import type { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { Vault, AppError } from '../security.js'
import {
  defaultTicketSettings,
  type TicketSettings,
  type TicketPanel,
  type PanelView,
  type TicketRecord,
  type Transcript,
} from '../../shared/tickets.js'
export class TicketRepository {
  private readonly vault: Vault
  constructor(
    readonly db: DatabaseSync,
    key: string,
  ) {
    this.vault = new Vault(key)
    db.exec(`CREATE TABLE IF NOT EXISTS ticket_settings(guild_id TEXT PRIMARY KEY,payload TEXT NOT NULL,revision INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS ticket_panels(guild_id TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,revision INTEGER NOT NULL,message_id TEXT,channel_id TEXT,published_at INTEGER,published TEXT,PRIMARY KEY(guild_id,id));
   CREATE TABLE IF NOT EXISTS ticket_templates(guild_id TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(guild_id,id));
   CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY,guild_id TEXT NOT NULL,author_id TEXT NOT NULL,topic_id TEXT NOT NULL,status TEXT NOT NULL,channel_id TEXT,payload TEXT NOT NULL,revision INTEGER NOT NULL,last_activity INTEGER NOT NULL,created_at INTEGER NOT NULL,closed_at INTEGER,expires_at INTEGER,transcript TEXT);
   CREATE INDEX IF NOT EXISTS tickets_guild ON tickets(guild_id,created_at DESC);
   CREATE INDEX IF NOT EXISTS tickets_channel ON tickets(channel_id);
   CREATE TABLE IF NOT EXISTS ticket_counters(guild_id TEXT NOT NULL,bucket TEXT NOT NULL,value INTEGER NOT NULL,PRIMARY KEY(guild_id,bucket));
   CREATE TABLE IF NOT EXISTS ticket_audit(id INTEGER PRIMARY KEY,guild_id TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS ticket_publish_ops(guild_id TEXT NOT NULL,request_id TEXT NOT NULL,panel_id TEXT NOT NULL,result TEXT,at INTEGER NOT NULL,PRIMARY KEY(guild_id,request_id));`)
  }
  settings(guild: string): { settings: TicketSettings; revision: number } {
    const row = this.db
      .prepare('SELECT payload,revision FROM ticket_settings WHERE guild_id=?')
      .get(guild) as { payload: string; revision: number } | undefined
    return row
      ? { settings: JSON.parse(row.payload), revision: row.revision }
      : { settings: structuredClone(defaultTicketSettings), revision: 0 }
  }
  saveSettings(guild: string, settings: TicketSettings, revision: number, actor: string) {
    if (this.settings(guild).revision !== revision) throw new AppError(409, 'revisionConflict')
    this.db
      .prepare(
        'INSERT INTO ticket_settings VALUES(?,?,?) ON CONFLICT(guild_id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision',
      )
      .run(guild, JSON.stringify(settings), revision + 1)
    this.audit(guild, actor, 'settings.updated', guild)
    return { settings, revision: revision + 1 }
  }
  panels(guild: string): PanelView[] {
    return this.db
      .prepare('SELECT * FROM ticket_panels WHERE guild_id=? ORDER BY rowid DESC')
      .all(guild)
      .map((row) => this.panelRow(row as unknown as PanelRow))
  }
  private panelRow(row: PanelRow): PanelView {
    return {
      panel: JSON.parse(row.payload),
      revision: row.revision,
      messageId: row.message_id,
      publishedChannelId: row.channel_id,
      publishedAt: row.published_at,
      publishedPanel: row.published ? JSON.parse(row.published) : null,
    }
  }
  panel(guild: string, id: string, published = false): PanelView | null {
    const row = this.db
      .prepare('SELECT * FROM ticket_panels WHERE guild_id=? AND id=?')
      .get(guild, id) as unknown as PanelRow | undefined
    if (!row || (published && !row.published)) return null
    return { ...this.panelRow(row), ...(published ? { panel: JSON.parse(row.published!) } : {}) }
  }
  savePanel(guild: string, panel: TicketPanel, revision: number, actor: string) {
    const before = this.panel(guild, panel.id)
    if ((before?.revision ?? 0) !== revision) throw new AppError(409, 'revisionConflict')
    this.db
      .prepare(
        'INSERT INTO ticket_panels(guild_id,id,payload,revision) VALUES(?,?,?,?) ON CONFLICT(guild_id,id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision',
      )
      .run(guild, panel.id, JSON.stringify(panel), revision + 1)
    this.audit(guild, actor, 'panel.saved', panel.id)
    return this.panel(guild, panel.id)!
  }
  published(guild: string, panel: TicketPanel, message: string, channel: string, actor: string) {
    this.db
      .prepare(
        'UPDATE ticket_panels SET message_id=?,channel_id=?,published_at=?,published=? WHERE guild_id=? AND id=?',
      )
      .run(message, channel, Date.now(), JSON.stringify(panel), guild, panel.id)
    this.audit(guild, actor, 'panel.published', panel.id)
  }
  deletePanel(guild: string, id: string, actor: string) {
    this.db.prepare('DELETE FROM ticket_panels WHERE guild_id=? AND id=?').run(guild, id)
    this.audit(guild, actor, 'panel.deleted', id)
  }
  templates(guild: string): TicketPanel[] {
    return this.db
      .prepare('SELECT payload FROM ticket_templates WHERE guild_id=? ORDER BY rowid DESC')
      .all(guild)
      .map((row) => JSON.parse(String(row.payload)))
  }
  template(guild: string, panel: TicketPanel, actor: string) {
    if (this.templates(guild).length >= 100) throw new AppError(400, 'invalidInput')
    const p = { ...panel, id: randomUUID() }
    this.db.prepare('INSERT INTO ticket_templates VALUES(?,?,?)').run(guild, p.id, JSON.stringify(p))
    this.audit(guild, actor, 'template.saved', p.id)
    return p
  }
  deleteTemplate(guild: string, id: string, actor: string) {
    this.db.prepare('DELETE FROM ticket_templates WHERE guild_id=? AND id=?').run(guild, id)
    this.audit(guild, actor, 'template.deleted', id)
  }
  get(guild: string, id: string): TicketRecord | null {
    const row = this.db.prepare('SELECT * FROM tickets WHERE guild_id=? AND id=?').get(guild, id)
    return row ? this.decode(row) : null
  }
  byChannel(guild: string, channel: string) {
    const row = this.db.prepare('SELECT * FROM tickets WHERE guild_id=? AND channel_id=?').get(guild, channel)
    return row ? this.decode(row) : null
  }
  private decode(row: Record<string, unknown>): TicketRecord {
    return {
      ...this.vault.decrypt<TicketRecord>(String(row.payload), `ticket:${row.id}`),
      status: row.status as TicketRecord['status'],
      channelId: row.channel_id as string | null,
      revision: Number(row.revision),
      lastActivity: Number(row.last_activity),
    }
  }
  list(guild: string, limit = 100, offset = 0): TicketRecord[] {
    return this.db
      .prepare('SELECT * FROM tickets WHERE guild_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(guild, limit, offset)
      .map((row) => this.decode(row))
  }
  count(guild: string) {
    return Number(this.db.prepare('SELECT COUNT(*) n FROM tickets WHERE guild_id=?').get(guild)?.n ?? 0)
  }
  active(guild: string): TicketRecord[] {
    return this.db
      .prepare(
        "SELECT * FROM tickets WHERE guild_id=? AND status IN ('creating','open','progress','closing','error')",
      )
      .all(guild)
      .map((row) => this.decode(row))
  }
  guilds() {
    return this.db
      .prepare('SELECT DISTINCT guild_id FROM tickets')
      .all()
      .map((r) => String(r.guild_id))
  }
  reserve(
    guild: string,
    author: { id: string; name: string },
    panel: TicketPanel,
    topic: TicketRecord['topic'],
    answers: Record<string, string>,
    settings: TicketSettings,
  ): TicketRecord {
    const active = this.active(guild),
      owned = active.filter((t) => t.authorId === author.id)
    if (
      active.length >= settings.maxActive ||
      owned.length >= settings.maxPerUser ||
      owned.filter((t) => t.topic.id === topic.id).length >= topic.maxPerUser
    )
      throw new AppError(409, 'ticketLimit')
    const latest = this.db
      .prepare(
        'SELECT created_at FROM tickets WHERE guild_id=? AND author_id=? ORDER BY created_at DESC LIMIT 1',
      )
      .get(guild, author.id)
    if (latest && Date.now() - Number(latest.created_at) < settings.cooldownSeconds * 1000)
      throw new AppError(429, 'ticketCooldown')
    const bucket = settings.globalNumbering ? 'all' : topic.id
    const counter = this.db
      .prepare('SELECT value FROM ticket_counters WHERE guild_id=? AND bucket=?')
      .get(guild, bucket)
    const n =
      (!settings.continuousNumbering &&
      !active.some((t) => settings.globalNumbering || t.topic.id === topic.id)
        ? 0
        : Number(counter?.value ?? 0)) + 1
    this.db
      .prepare(
        'INSERT INTO ticket_counters VALUES(?,?,?) ON CONFLICT(guild_id,bucket) DO UPDATE SET value=excluded.value',
      )
      .run(guild, bucket, n)
    const record: TicketRecord = {
      id: randomUUID(),
      guildId: guild,
      number: n,
      panelId: panel.id,
      topic,
      authorId: author.id,
      authorName: author.name,
      status: 'creating',
      staffId: null,
      channelId: null,
      staffThreadId: null,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      closedAt: null,
      reason: '',
      revision: 1,
      settings: structuredClone(settings),
      answers,
      notes: [],
    }
    this.db
      .prepare(
        'INSERT INTO tickets(id,guild_id,author_id,topic_id,status,channel_id,payload,revision,last_activity,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        record.id,
        guild,
        author.id,
        topic.id,
        record.status,
        null,
        this.vault.encrypt(record, `ticket:${record.id}`),
        1,
        record.lastActivity,
        record.createdAt,
      )
    this.audit(guild, author.id, 'ticket.reserved', record.id)
    return record
  }
  save(t: TicketRecord) {
    const result = this.db
      .prepare(
        'UPDATE tickets SET status=?,channel_id=?,payload=?,revision=revision+1,last_activity=?,closed_at=?,expires_at=? WHERE id=? AND guild_id=? AND revision=?',
      )
      .run(
        t.status,
        t.channelId,
        this.vault.encrypt({ ...t, revision: t.revision + 1 }, `ticket:${t.id}`),
        t.lastActivity,
        t.closedAt,
        t.closedAt ? t.closedAt + t.settings.retentionDays * 86400000 : null,
        t.id,
        t.guildId,
        t.revision,
      )
    if (!result.changes) throw new AppError(409, 'revisionConflict')
    return { ...t, revision: t.revision + 1 }
  }
  touch(guild: string, channel: string) {
    this.db
      .prepare(
        "UPDATE tickets SET last_activity=? WHERE guild_id=? AND channel_id=? AND status IN ('open','progress')",
      )
      .run(Date.now(), guild, channel)
  }
  transcript(t: TicketRecord, value: Transcript) {
    this.db
      .prepare('UPDATE tickets SET transcript=? WHERE id=? AND guild_id=?')
      .run(this.vault.encrypt(value, `transcript:${t.id}`), t.id, t.guildId)
  }
  readTranscript(guild: string, id: string): Transcript | null {
    const row = this.db
      .prepare('SELECT transcript,expires_at FROM tickets WHERE guild_id=? AND id=?')
      .get(guild, id)
    return row?.transcript && (!row.expires_at || Number(row.expires_at) > Date.now())
      ? this.vault.decrypt<Transcript>(String(row.transcript), `transcript:${id}`)
      : null
  }
  audit(guild: string, actor: string, action: string, target: string) {
    this.db
      .prepare('INSERT INTO ticket_audit(guild_id,actor_id,action,target,at) VALUES(?,?,?,?,?)')
      .run(guild, actor, action, target, Date.now())
  }
  audits(guild: string) {
    return this.db
      .prepare(
        'SELECT actor_id actor,action,target,at FROM ticket_audit WHERE guild_id=? ORDER BY id DESC LIMIT 100',
      )
      .all(guild)
  }
  beginPublish(guild: string, request: string, panel: string) {
    const row = this.db
      .prepare('SELECT result,panel_id FROM ticket_publish_ops WHERE guild_id=? AND request_id=?')
      .get(guild, request)
    if (row) {
      if (row.panel_id !== panel || !row.result) throw new AppError(409, 'ticketUncertain')
      return JSON.parse(String(row.result)) as { id: string; channelId: string; demo: boolean }
    }
    if (
      this.db
        .prepare('SELECT 1 FROM ticket_publish_ops WHERE guild_id=? AND panel_id=? AND result IS NULL')
        .get(guild, panel)
    )
      throw new AppError(409, 'ticketUncertain')
    this.db
      .prepare('INSERT INTO ticket_publish_ops VALUES(?,?,?,NULL,?)')
      .run(guild, request, panel, Date.now())
    return null
  }
  pendingPublish(guild: string, panel: string) {
    return this.db
      .prepare(
        'SELECT request_id,at FROM ticket_publish_ops WHERE guild_id=? AND panel_id=? AND result IS NULL',
      )
      .get(guild, panel) as { request_id: string; at: number } | undefined
  }
  finishPublish(guild: string, request: string, result: unknown) {
    this.db
      .prepare('UPDATE ticket_publish_ops SET result=? WHERE guild_id=? AND request_id=?')
      .run(JSON.stringify(result), guild, request)
  }
  clearTranscript(id: string) {
    this.db.prepare('UPDATE tickets SET transcript=NULL WHERE id=?').run(id)
  }
  cancelPublish(guild: string, request: string) {
    this.db
      .prepare('DELETE FROM ticket_publish_ops WHERE guild_id=? AND request_id=? AND result IS NULL')
      .run(guild, request)
  }
  cleanup() {
    const now = Date.now()
    const expired = this.db
      .prepare(
        'SELECT * FROM tickets WHERE expires_at IS NOT NULL AND expires_at<=? AND (transcript IS NOT NULL OR expires_at>0)',
      )
      .all(now)
    for (const row of expired) {
      const t = this.decode(row)
      t.answers = {}
      t.notes = []
      t.reason = ''
      this.db
        .prepare('UPDATE tickets SET transcript=NULL,payload=?,expires_at=0 WHERE id=?')
        .run(this.vault.encrypt(t, `ticket:${t.id}`), t.id)
    }
    this.db.prepare('DELETE FROM ticket_audit WHERE at<?').run(now - 90 * 86400000)
    this.db
      .prepare('DELETE FROM ticket_publish_ops WHERE at<? AND result IS NOT NULL')
      .run(now - 30 * 86400000)
  }
}
interface PanelRow {
  payload: string
  revision: number
  message_id: string | null
  channel_id: string | null
  published_at: number | null
  published: string | null
}
