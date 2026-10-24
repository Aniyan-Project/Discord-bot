import { MessageFlags, type ButtonInteraction } from 'discord.js'
import { normalizeLocale } from '../../../shared/domain.js'
import type { BotContext } from '../core/context.js'
import { errorMessage } from '../presentation/errors.js'
import { payload } from '../presentation/payload.js'
import type { InteractionHandler } from './types.js'
async function confirmation(runtime: BotContext, interaction: ButtonInteraction) {
  const [action, token] = interaction.customId.split(':')
  if (!token) return
  const guildId = runtime.engine.pendingGuild(token)
  const locale = guildId
    ? runtime.store.settings(guildId).settings.locale
    : normalizeLocale(interaction.locale)
  try {
    const context = runtime.engine.actionContext(token, interaction.user.id)
    await interaction.deferUpdate()
    const result = await runtime.engine.confirm(token, context, action === 'cancel')
    await interaction.editReply(payload(result))
  } catch (error) {
    if (interaction.deferred)
      await interaction
        .followUp({ content: errorMessage(error, locale), flags: MessageFlags.Ephemeral })
        .catch(() => undefined)
    else
      await interaction
        .reply({ content: errorMessage(error, locale), flags: MessageFlags.Ephemeral })
        .catch(() => undefined)
  }
}
export const createConfirmationHandler = (runtime: BotContext): InteractionHandler => ({
  name: 'confirmation',
  matches: (i) => i.isButton() && /^(confirm|cancel):/.test(i.customId),
  async handle(i) {
    if (i.isButton()) await confirmation(runtime, i)
  },
})
