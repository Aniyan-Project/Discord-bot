import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js'
import type { BranilistService } from '../branilist.js'
import type { Config } from '../config.js'
import { AppError } from '../security.js'
import type { Store } from '../store.js'
import { CommandEngine } from './core/engine.js'
import { registerBotEvents } from './events/index.js'
import { TicketService } from './tickets/service.js'
import { TicketDiscord } from './tickets/discord.js'
export class BotRuntime {
  readonly client: Client
  readonly engine: CommandEngine
  readonly tickets: TicketService
  private maintenance?: ReturnType<typeof setInterval>
  private readonly unregisterEvents: () => void
  constructor(
    readonly config: Config,
    store: Store,
    api: BranilistService,
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        ...(config.ENABLE_MESSAGE_CONTENT ? [GatewayIntentBits.MessageContent] : []),
      ],
      allowedMentions: { parse: [], repliedUser: false },
      failIfNotExists: false,
    })
    this.engine = new CommandEngine(config, store, api)
    this.tickets = new TicketService(
      store,
      new TicketDiscord(this.client, config.DEMO_MODE, config.ENABLE_MESSAGE_CONTENT, config.APP_URL),
      config.ENCRYPTION_KEY,
    )
    this.unregisterEvents = registerBotEvents({
      config,
      store,
      api,
      client: this.client,
      engine: this.engine,
      tickets: this.tickets,
    })
  }
  installed(guildId: string): boolean {
    return this.config.DEMO_MODE || (this.client.isReady() && this.client.guilds.cache.has(guildId))
  }
  status() {
    return {
      online: this.config.DEMO_MODE ? false : this.client.isReady(),
      latency: this.client.isReady() ? Math.max(0, Math.round(this.client.ws.ping)) : null,
      servers: this.config.DEMO_MODE ? 1 : this.client.guilds.cache.size,
    }
  }
  async channels(guildId: string): Promise<Array<{ id: string; name: string }>> {
    if (this.config.DEMO_MODE)
      return [
        { id: '1200000000000000001', name: 'anime-e-manga' },
        { id: '1200000000000000002', name: 'comandos-do-bot' },
        { id: '1200000000000000003', name: 'conversa-geral' },
      ]
    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) throw new AppError(409, 'notInstalled')
    const channels = await guild.channels.fetch()
    return channels
      .filter(
        (c) =>
          c !== null &&
          c.isTextBased() &&
          !c.isThread() &&
          !!c
            .permissionsFor(guild.members.me!)
            ?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]),
      )
      .map((c) => ({ id: c!.id, name: c!.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  async nickname(guildId: string, value: string): Promise<void> {
    if (this.config.DEMO_MODE) return
    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) throw new AppError(409, 'notInstalled')
    try {
      const member = guild.members.me ?? (await guild.members.fetchMe())
      await member.setNickname(value || null)
    } catch {
      throw new AppError(403, 'forbidden')
    }
  }
  async start(): Promise<void> {
    if (!this.config.DEMO_MODE) await this.client.login(this.config.DISCORD_TOKEN)
    let running = false
    this.maintenance = setInterval(() => {
      if (!running) {
        running = true
        void this.tickets
          .maintenance()
          .catch(() => {})
          .finally(() => {
            running = false
          })
      }
    }, 60000)
    this.maintenance.unref()
  }
  async close(): Promise<void> {
    if (this.maintenance) clearInterval(this.maintenance)
    try {
      await this.client.destroy()
    } finally {
      this.unregisterEvents()
    }
  }
}
