import { Events } from 'discord.js'
import type { BotEventModule } from './types.js'
export const ticketActivityEvent: BotEventModule = {
  name: Events.MessageCreate,
  register(context) {
    const listener = (message: import('discord.js').Message) => {
      if (!message.author.bot && message.guildId)
        context.tickets?.repo.touch(message.guildId, message.channelId)
    }
    context.client.on(Events.MessageCreate, listener)
    const deleted = (channel: import('discord.js').Channel) => {
      if ('guild' in channel)
        void context.tickets?.channelDeleted(channel.guild.id, channel.id).catch(() => {})
    }
    context.client.on(Events.ChannelDelete, deleted)
    context.client.on(Events.ThreadDelete, deleted)
    return () => {
      context.client.off(Events.MessageCreate, listener)
      context.client.off(Events.ChannelDelete, deleted)
      context.client.off(Events.ThreadDelete, deleted)
    }
  },
}
