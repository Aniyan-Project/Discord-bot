import { Events } from 'discord.js'
import { createInteractionRouter } from '../handlers/index.js'
import type { BotEventModule } from './types.js'
export const interactionCreateEvent: BotEventModule = {
  name: Events.InteractionCreate,
  register(context) {
    const listener = createInteractionRouter(context)
    context.client.on(Events.InteractionCreate, listener)
    return () => {
      context.client.off(Events.InteractionCreate, listener)
    }
  },
}
