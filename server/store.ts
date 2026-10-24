import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  defaultSettings,
  guildSettingsSchema,
  type GuildSettings,
  type UserInfo,
  type LinkedAccount,
} from '../shared/domain.js'
import { Vault, hashToken, randomToken } from './security.js'
import { parseStudioDraft, type StudioDraft } from '../shared/message-studio.js'
export interface DiscordTokens {
  access_token: string
  refresh_token: string
  expiresAt: number
}
export interface Session {
  id: string
  user: UserInfo
  discord: DiscordTokens
  csrfToken: string
  expiresAt: number
}
export interface AccountTokens {
  access_token: string
  refresh_token: string
  expiresAt: number
  scopes: string[]
  profile: LinkedAccount
}
interface EncryptedRow {
  payload: string
  expires_at?: number
}
export class Store {
  readonly db: DatabaseSync
  private readonly vault: Vault
  private readonly guildLocks = new Map<string, Promise<void>>()
  constructor(
    path: string,
    key: string,
    private readonly defaults: Partial<GuildSettings> = {},
  ) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.vault = new Vault(key)
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS guild_settings (guild_id TEXT PRIMARY KEY, payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS oauth_states (state_hash TEXT PRIMARY KEY, flow TEXT NOT NULL, payload TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS accounts (discord_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS command_events (id INTEGER PRIMARY KEY, guild_id TEXT NOT NULL, command TEXT NOT NULL, ok INTEGER NOT NULL, at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS events_guild_time ON command_events(guild_id,at);
      CREATE TABLE IF NOT EXISTS audit_events (id INTEGER PRIMARY KEY, guild_id TEXT NOT NULL, actor_id TEXT NOT NULL, changed_fields TEXT NOT NULL, at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS studio_drafts (guild_id TEXT NOT NULL, actor_id TEXT NOT NULL, payload TEXT NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(guild_id,actor_id));
      CREATE TABLE IF NOT EXISTS studio_deliveries (guild_id TEXT NOT NULL, request_id TEXT NOT NULL, actor_id TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT, at INTEGER NOT NULL, PRIMARY KEY(guild_id,request_id));
      PRAGMA user_version=1;`)
    this.cleanup()
  }
  settings(id: string): { settings: GuildSettings; revision: number } {
    const row = this.db.prepare('SELECT payload, revision FROM guild_settings WHERE guild_id=?').get(id) as
      { payload: string; revision: number } | undefined
    return row
      ? { settings: guildSettingsSchema.parse(JSON.parse(row.payload)), revision: row.revision }
      : { settings: { ...defaultSettings, ...this.defaults }, revision: 0 }
  }
  studioDraft(guildId: string, actorId: string): { draft: StudioDraft | null; revision: number } {
    const row = this.db
      .prepare('SELECT payload,revision FROM studio_drafts WHERE guild_id=? AND actor_id=?')
      .get(guildId, actorId) as { payload: string; revision: number } | undefined
    return row
      ? { draft: parseStudioDraft(JSON.parse(row.payload)), revision: row.revision }
      : { draft: null, revision: 0 }
  }
  saveStudioDraft(guildId: string, actorId: string, draft: StudioDraft, revision: number) {
    if (this.studioDraft(guildId, actorId).revision !== revision) throw Error('revisionConflict')
    this.db
      .prepare(
        'INSERT INTO studio_drafts VALUES(?,?,?,?) ON CONFLICT(guild_id,actor_id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision',
      )
      .run(guildId, actorId, JSON.stringify(draft), revision + 1)
    return { revision: revision + 1 }
  }
  studioDelivery(guildId: string, requestId: string) {
    return this.db
      .prepare('SELECT actor_id,fingerprint,result FROM studio_deliveries WHERE guild_id=? AND request_id=?')
      .get(guildId, requestId) as { actor_id: string; fingerprint: string; result: string | null } | undefined
  }
  beginStudioDelivery(guildId: string, requestId: string, actorId: string, fingerprint: string) {
    this.db
      .prepare('INSERT INTO studio_deliveries VALUES(?,?,?,?,NULL,?)')
      .run(guildId, requestId, actorId, fingerprint, Date.now())
  }
  finishStudioDelivery(guildId: string, requestId: string, result: unknown) {
    this.db
      .prepare('UPDATE studio_deliveries SET result=? WHERE guild_id=? AND request_id=?')
      .run(JSON.stringify(result), guildId, requestId)
  }
  cancelStudioDelivery(guildId: string, requestId: string) {
    this.db
      .prepare('DELETE FROM studio_deliveries WHERE guild_id=? AND request_id=? AND result IS NULL')
      .run(guildId, requestId)
  }
  async withGuildLock<T>(id: string, action: () => Promise<T>): Promise<T> {
    const previous = this.guildLocks.get(id) ?? Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const tail = previous.then(() => gate)
    this.guildLocks.set(id, tail)
    await previous
    try {
      return await action()
    } finally {
      release()
      if (this.guildLocks.get(id) === tail) this.guildLocks.delete(id)
    }
  }
  saveSettings(
    id: string,
    settings: GuildSettings,
    expectedRevision: number,
    actorId: string,
  ): { settings: GuildSettings; revision: number } {
    const before = this.settings(id)
    if (before.revision !== expectedRevision) throw Error('revisionConflict')
    const changed = Object.keys(settings).filter(
      (key) =>
        JSON.stringify(settings[key as keyof GuildSettings]) !==
        JSON.stringify(before.settings[key as keyof GuildSettings]),
    )
    this.db.exec('BEGIN IMMEDIATE')
    try {
      if (expectedRevision === 0)
        this.db
          .prepare('INSERT INTO guild_settings(guild_id,payload,revision) VALUES(?,?,1)')
          .run(id, JSON.stringify(settings))
      else if (
        this.db
          .prepare('UPDATE guild_settings SET payload=?,revision=revision+1 WHERE guild_id=? AND revision=?')
          .run(JSON.stringify(settings), id, expectedRevision).changes !== 1
      )
        throw Error('revisionConflict')
      this.db
        .prepare('INSERT INTO audit_events(guild_id,actor_id,changed_fields,at) VALUES(?,?,?,?)')
        .run(id, actorId, JSON.stringify(changed), Date.now())
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
    return { settings, revision: expectedRevision + 1 }
  }
  createSession(user: UserInfo, discord: DiscordTokens): Session {
    const session: Session = {
      id: randomToken(),
      user,
      discord,
      csrfToken: randomToken(),
      expiresAt: Date.now() + 7 * 86400000,
    }
    this.putSession(session)
    return session
  }
  putSession(session: Session): void {
    this.db
      .prepare('INSERT OR REPLACE INTO sessions(id,payload,expires_at) VALUES(?,?,?)')
      .run(
        hashToken(session.id),
        this.vault.encrypt(session, `session:${hashToken(session.id)}`),
        session.expiresAt,
      )
  }
  session(id: string | undefined): Session | null {
    if (!id) return null
    const row = this.db.prepare('SELECT payload,expires_at FROM sessions WHERE id=?').get(hashToken(id)) as
      EncryptedRow | undefined
    if (!row || Number(row.expires_at) <= Date.now()) return null
    return this.vault.decrypt<Session>(row.payload, `session:${hashToken(id)}`)
  }
  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM sessions WHERE id=?').run(hashToken(id))
  }
  createState(flow: 'discord' | 'branilist', payload: unknown): string {
    const state = randomToken()
    this.db
      .prepare('INSERT INTO oauth_states VALUES(?,?,?,?)')
      .run(
        hashToken(state),
        flow,
        this.vault.encrypt(payload, `state:${flow}:${hashToken(state)}`),
        Date.now() + 10 * 60000,
      )
    return state
  }
  takeState<T>(state: string, flow: 'discord' | 'branilist'): T | null {
    const row = this.db
      .prepare('DELETE FROM oauth_states WHERE state_hash=? AND flow=? RETURNING payload,expires_at')
      .get(hashToken(state), flow) as EncryptedRow | undefined
    return row && Number(row.expires_at) > Date.now()
      ? this.vault.decrypt<T>(row.payload, `state:${flow}:${hashToken(state)}`)
      : null
  }
  account(discordId: string): AccountTokens | null {
    const row = this.db.prepare('SELECT payload FROM accounts WHERE discord_id=?').get(discordId) as
      EncryptedRow | undefined
    return row ? this.vault.decrypt<AccountTokens>(row.payload, `account:${discordId}`) : null
  }
  putAccount(id: string, value: AccountTokens): void {
    this.db
      .prepare('INSERT OR REPLACE INTO accounts VALUES(?,?)')
      .run(id, this.vault.encrypt(value, `account:${id}`))
  }
  unlink(id: string): void {
    this.db.prepare('DELETE FROM accounts WHERE discord_id=?').run(id)
  }
  event(guildId: string, command: string, ok: boolean): void {
    this.db
      .prepare('INSERT INTO command_events(guild_id,command,ok,at) VALUES(?,?,?,?)')
      .run(guildId, command, Number(ok), Date.now())
  }
  events(guildId: string): Array<{ id: number; command: string; ok: number; at: number }> {
    return this.db
      .prepare('SELECT id,command,ok,at FROM command_events WHERE guild_id=? ORDER BY id DESC LIMIT 30')
      .all(guildId) as Array<{ id: number; command: string; ok: number; at: number }>
  }
  stats(guildId: string): { total: number; today: number; successful: number } {
    return this.db
      .prepare(
        'SELECT COUNT(*) total,COALESCE(SUM(at >= ?),0) today,COALESCE(SUM(ok),0) successful FROM command_events WHERE guild_id=?',
      )
      .get(Date.now() - 86400000, guildId) as { total: number; today: number; successful: number }
  }
  cleanup(): void {
    const now = Date.now()
    this.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now)
    this.db.prepare('DELETE FROM oauth_states WHERE expires_at<=?').run(now)
    this.db.prepare('DELETE FROM command_events WHERE at<?').run(now - 30 * 86400000)
    this.db.prepare('DELETE FROM audit_events WHERE at<?').run(now - 90 * 86400000)
    this.db.prepare('DELETE FROM studio_deliveries WHERE at<?').run(now - 7 * 86400000)
  }
  close(): void {
    this.db.close()
  }
}
