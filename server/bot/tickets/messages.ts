import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  EmbedBuilder,
  MessageFlags,
  escapeMarkdown,
  type MessageCreateOptions,
} from 'discord.js'
import type { TicketPanel, TicketRecord } from '../../../shared/tickets.js'
import { tt } from '../../../shared/ticket-i18n.js'
export function panelPayload(panel: TicketPanel, locale: string): MessageCreateOptions {
  const row = new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>()
  if (panel.style === 'select') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`ticket:open:${panel.id}`)
      .setPlaceholder(tt(locale, 'Selecionar assunto'))
    for (const t of panel.topics) {
      const o = new StringSelectMenuOptionBuilder().setLabel(t.name).setValue(t.id)
      if (t.description) o.setDescription(t.description)
      if (t.emoji) {
        try {
          o.setEmoji(t.emoji)
        } catch {}
      }
      menu.addOptions(o)
    }
    row.addComponents(menu)
  } else
    for (const t of panel.topics) {
      const b = new ButtonBuilder()
        .setCustomId(`ticket:open:${panel.id}:${t.id}`)
        .setLabel(t.name)
        .setStyle(ButtonStyle.Primary)
      if (t.emoji) {
        try {
          b.setEmoji(t.emoji)
        } catch {}
      }
      row.addComponents(b)
    }
  if (panel.format === 'classic') {
    const embed = new EmbedBuilder().setTitle(panel.title).setColor(parseInt(panel.color.slice(1), 16))
    if (panel.description) embed.setDescription(panel.description)
    if (panel.footer) embed.setFooter({ text: panel.footer })
    if (panel.image) embed.setImage(panel.image)
    return { embeds: [embed], components: [row], allowedMentions: { parse: [] } }
  }
  const box = new ContainerBuilder()
    .setAccentColor(parseInt(panel.color.slice(1), 16))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${panel.title}`))
  if (panel.description) box.addTextDisplayComponents(new TextDisplayBuilder().setContent(panel.description))
  if (panel.image)
    box.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(panel.image)),
    )
  box
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        panel.topics
          .map(
            (t) =>
              `${t.emoji} **${escapeMarkdown(t.name)}**${t.description ? '\n' + escapeMarkdown(t.description) : ''}`,
          )
          .join('\n\n'),
      ),
    )
  if (panel.footer)
    box
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${panel.footer}`))
  box.addActionRowComponents(row)
  return { flags: MessageFlags.IsComponentsV2, components: [box], allowedMentions: { parse: [] } }
}
export function ticketControls(t: TicketRecord) {
  const tr = (s: string) => tt(t.settings.locale, s)
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:claim:${t.id}`)
      .setLabel(tr('Assumir ticket'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ticket:close:${t.id}`)
      .setLabel(tr('Encerrar ticket'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ticket:transcript:${t.id}`)
      .setLabel(tr('Transcrição'))
      .setStyle(ButtonStyle.Secondary),
  )
}
