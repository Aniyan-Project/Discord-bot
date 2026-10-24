import { MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js'
import { normalizeLocale } from '../../../shared/domain.js'
import { findCommand } from '../commands/registry.js'
import type { BotContext } from '../core/context.js'
import { errorMessage } from '../presentation/errors.js'
import { payload } from '../presentation/payload.js'
import type { InteractionHandler } from './types.js'
async function slash(runtime: BotContext, interaction: ChatInputCommandInteraction): Promise<void> {
  const definition = findCommand(interaction.commandName)
  if (!definition) return
  const command = definition.id
  const locale = interaction.guildId
    ? runtime.store.settings(interaction.guildId).settings.locale
    : normalizeLocale(interaction.locale)
  const privateReply =
    typeof definition.privateReply === 'function'
      ? definition.privateReply(interaction)
      : definition.privateReply
  try {
    await interaction.deferReply(privateReply ? { flags: MessageFlags.Ephemeral } : {})
    const result = await runtime.engine.execute(command, definition.slashArgs?.(interaction) ?? [], {
      userId: interaction.user.id,
      guildId: interaction.guildId ?? undefined,
      channelId: interaction.channelId,
      parentChannelId: interaction.channel?.isThread() ? interaction.channel.parentId : null,
      locale,
      source: 'slash',
      manageGuild: interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false,
    })
    await interaction.editReply(payload(result))
  } catch (error) {
    const content = errorMessage(error, locale)
    if (interaction.deferred || interaction.replied)
      await interaction.editReply({ content, embeds: [], components: [] }).catch(() => undefined)
    else await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined)
  }
}
export const createSlashHandler = (runtime: BotContext): InteractionHandler => ({
  name: 'slash',
  matches: (i) => i.isChatInputCommand(),
  async handle(i) {
    if (i.isChatInputCommand()) await slash(runtime, i)
  },
})
