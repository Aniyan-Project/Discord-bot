import { MessageFlags, type ButtonInteraction, type StringSelectMenuInteraction } from 'discord.js'
import { normalizeLocale } from '../../../shared/domain.js'
import { AppError } from '../../security.js'
import type { BotContext } from '../core/context.js'
import { errorMessage } from '../presentation/errors.js'
import { payload } from '../presentation/payload.js'
import type { InteractionHandler } from './types.js'
async function searchInteraction(
  runtime: BotContext,
  interaction: ButtonInteraction | StringSelectMenuInteraction,
): Promise<void> {
  let locale = normalizeLocale(interaction.locale)
  try {
    const [, action, token] = /^media:(select|prev|next):([\w-]+)$/.exec(interaction.customId) ?? []
    if (!token || !action || (action === 'select') !== interaction.isStringSelectMenu())
      throw new AppError(400, 'invalidInput')
    const context = runtime.engine.searchContext(token, interaction.user.id)
    locale = runtime.engine.settings(context).locale
    await interaction.deferUpdate()
    const result = await runtime.engine.interactSearch(
      token,
      {
        ...context,
        guildId: interaction.guildId ?? undefined,
        channelId: interaction.channelId,
        parentChannelId: interaction.channel?.isThread() ? interaction.channel.parentId : null,
      },
      action as 'select' | 'prev' | 'next',
      interaction.isStringSelectMenu() ? interaction.values[0] : undefined,
    )
    await interaction.editReply(payload(result))
  } catch (error) {
    const response = { content: errorMessage(error, locale), flags: MessageFlags.Ephemeral as const }
    if (interaction.deferred || interaction.replied)
      await interaction.followUp(response).catch(() => undefined)
    else await interaction.reply(response).catch(() => undefined)
  }
}
export const createMediaSearchHandler = (runtime: BotContext): InteractionHandler => ({
  name: 'media-search',
  matches: (i) => (i.isStringSelectMenu() || i.isButton()) && /^media:(select|prev|next):/.test(i.customId),
  async handle(i) {
    if (i.isStringSelectMenu() || i.isButton()) await searchInteraction(runtime, i)
  },
})
