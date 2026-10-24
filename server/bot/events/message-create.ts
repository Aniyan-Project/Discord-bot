import { Events, PermissionFlagsBits, type Message } from 'discord.js'
import { t } from '../../../shared/i18n.js'
import type { Invocation } from '../core/types.js'
import { parsePrefix } from '../parsing/prefix.js'
import { errorMessage } from '../presentation/errors.js'
import { payload } from '../presentation/payload.js'
import type { BotEventModule } from './types.js'
export const messageCreateEvent: BotEventModule = {
  name: Events.MessageCreate,
  register(runtime) {
    const listener = async (message: Message) => {
      if (message.author.bot || !message.guildId || !runtime.config.ENABLE_MESSAGE_CONTENT) return
      const settings = runtime.store.settings(message.guildId).settings
      if (!settings.prefixEnabled || !message.content.startsWith(settings.prefix)) return
      try {
        const parsed = parsePrefix(message.content, settings.prefix)
        if (!parsed) return
        const context: Invocation = {
          userId: message.author.id,
          guildId: message.guildId,
          channelId: message.channelId,
          parentChannelId: message.channel.isThread() ? message.channel.parentId : null,
          locale: settings.locale,
          source: 'prefix',
          manageGuild: message.member?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false,
        }
        const result = await runtime.engine.execute(parsed.command, parsed.args, context)
        if (result.private) {
          try {
            await message.author.send(payload(result))
            await message.react('✉️').catch(() => undefined)
          } catch {
            await message
              .reply({
                content: t(settings.locale, 'privateDMFailed'),
                allowedMentions: { parse: [], repliedUser: false },
              })
              .catch(() => undefined)
          }
        } else await message.reply(payload(result)).catch(() => undefined)
      } catch (error) {
        await message
          .reply({
            content: errorMessage(error, settings.locale),
            allowedMentions: { parse: [], repliedUser: false },
          })
          .catch(() => undefined)
      }
    }
    runtime.client.on(Events.MessageCreate, listener)
    return () => {
      runtime.client.off(Events.MessageCreate, listener)
    }
  },
}
