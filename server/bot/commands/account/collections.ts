import { escapeMarkdown } from 'discord.js'
import { t } from '../../../../shared/i18n.js'
import { embed } from '../../presentation/embeds.js'
import { defineCommand } from '../types.js'
export default defineCommand('collections', {
  aliases: ['colecoes', 'colecciones'],
  localizedNames: ['colecoes', 'colecciones'],
  privateReply: true,
  async execute(args, context) {
    const { api, settings, invocation: ctx } = context
    const locale = settings.locale

    const list = await api.collections(ctx.userId)
    return {
      private: true,
      embeds: [
        embed(
          settings,
          t(locale, 'collections'),
          list.map((c) => `**${escapeMarkdown(c.name)}** · ${c.itemCount} · ${c.visibility}`).join('\n\n') ||
            t(locale, 'noData'),
        ),
      ],
    }
  },
})
