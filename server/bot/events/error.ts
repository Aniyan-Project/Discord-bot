import { Events } from 'discord.js'
import type { BotEventModule } from './types.js'
export const errorEvent: BotEventModule = {
  name: Events.Error,
  register(context) {
    const listener = () => console.error('Discord connection error; the client will attempt recovery.')
    context.client.on(Events.Error, listener)
    return () => {
      context.client.off(Events.Error, listener)
    }
  },
}
