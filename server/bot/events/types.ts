import type { ClientEvents } from 'discord.js'
import type { BotContext } from '../core/context.js'
export interface BotEventModule {
  readonly name: keyof ClientEvents
  register: (context: BotContext) => () => void
}
