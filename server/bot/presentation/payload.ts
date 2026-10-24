import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, type APIEmbed } from 'discord.js'
import type { CommandResult } from '../core/types.js'
function components(result: CommandResult) {
  const rows: Array<ActionRowBuilder<ButtonBuilder>> = []
  if (result.link)
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(result.link.label).setURL(result.link.url),
      ),
    )
  if (result.confirm)
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Danger)
          .setLabel(result.confirm.label)
          .setCustomId(`confirm:${result.confirm.token}`),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel(result.confirm.cancel)
          .setCustomId(`cancel:${result.confirm.token}`),
      ),
    )
  return rows
}
export function payload(result: CommandResult) {
  if (result.componentsV2)
    return {
      flags: MessageFlags.IsComponentsV2 as const,
      components: result.componentsV2,
      allowedMentions: { parse: [] as [], repliedUser: false },
    }
  return {
    content: result.content ?? '',
    embeds: result.embeds ?? ([] as APIEmbed[]),
    components: components(result),
    allowedMentions: { parse: [] as [], repliedUser: false },
  }
}
