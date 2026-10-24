import type { BotContext } from '../core/context.js'
import { errorEvent } from './error.js'
import { interactionCreateEvent } from './interaction-create.js'
import { messageCreateEvent } from './message-create.js'
import type { BotEventModule } from './types.js'
export const botEvents: readonly BotEventModule[] = [errorEvent, interactionCreateEvent, messageCreateEvent]
export function registerBotEvents(context: BotContext) {
  const remove = botEvents.map((event) => event.register(context))
  return () => {
    for (const unregister of remove) unregister()
  }
}
