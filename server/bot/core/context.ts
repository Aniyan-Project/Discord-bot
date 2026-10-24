import type { Client } from 'discord.js'
import type { BranilistService } from '../../branilist.js'
import type { Config } from '../../config.js'
import type { Store } from '../../store.js'
import type { CommandEngine } from './engine.js'
import type { TicketService } from '../tickets/service.js'
export interface BotContext {
  readonly client: Client
  readonly config: Config
  readonly store: Store
  readonly api: BranilistService
  readonly engine: CommandEngine
  readonly tickets?: TicketService
}
