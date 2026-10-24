import { commandIds } from '../../../../shared/domain.js'
import { commandDescriptions, t } from '../../../../shared/i18n.js'
import { embed } from '../../presentation/embeds.js'
import { defineCommand } from '../types.js'
export default defineCommand('help', {
  aliases: ['ajuda', 'ayuda'],
  localizedNames: ['ajuda', 'ayuda'],
  privateReply: false,
  async execute(args, context) {
    const { settings } = context
    const locale = settings.locale

    return {
      embeds: [
        embed(
          settings,
          t(locale, 'commands'),
          commandIds
            .filter((id) => !settings.disabledCommands.includes(id))
            .map((id) => `**/${id}** · ${t(locale, commandDescriptions[id])}`)
            .join('\n'),
        ),
      ],
    }
  },
})
