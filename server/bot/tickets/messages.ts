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
import { transcriptUrl } from '../../tickets/links.js'
export function transcriptLinkRow(origin: string, guild: string, ticket: string, locale: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(tt(locale, 'Ver transcrição'))
      .setURL(transcriptUrl(origin, guild, ticket)),
  )
}
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
      .setLabel(tr(t.staffId ? 'Ticket assumido' : 'Assumir ticket'))
      .setDisabled(!!t.staffId || !['open', 'progress'].includes(t.status))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ticket:close:${t.id}`)
      .setLabel(tr('Encerrar ticket'))
      .setDisabled(!['open', 'progress'].includes(t.status))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ticket:transcript:${t.id}`)
      .setLabel(tr('Transcrição'))
      .setStyle(ButtonStyle.Secondary),
  )
}
export function ticketLogPayload(
  t: TicketRecord,
  action: string,
): Pick<MessageCreateOptions, 'embeds' | 'components' | 'allowedMentions'> {
  const tr = (s: string) => tt(t.settings.locale, s),
    closed = t.status === 'closed'
  const date = (at: number) => `<t:${Math.floor(at / 1000)}:f>`
  const embed = new EmbedBuilder()
    .setColor(closed ? 0xa8cfa3 : 0xff9955)
    .setAuthor({ name: 'Branilist · ' + tr('Central de suporte') })
    .setTitle(`Ticket #${t.number} · ${action}`)
    .setDescription(
      tr(
        closed
          ? 'Atendimento finalizado. O registro está disponível para consulta.'
          : t.staffId
            ? 'Atendimento em andamento.'
            : 'Um atendimento está aguardando a equipe.',
      ),
    )
    .addFields(
      { name: tr('Aberto por'), value: `<@${t.authorId}>`, inline: true },
      { name: tr('Assunto'), value: escapeMarkdown(t.topic.name), inline: true },
      {
        name: tr('Canal de origem'),
        value: escapeMarkdown(t.channelName || `ticket-${t.number}`),
        inline: true,
      },
      {
        name: tr('Responsável'),
        value: t.staffId ? `<@${t.staffId}>` : tr('Aguardando atendimento'),
        inline: true,
      },
      { name: tr('Aberto em'), value: date(t.createdAt), inline: true },
    )
  if (closed) {
    embed.addFields(
      {
        name: tr('Encerrado por'),
        value: t.closedBy && /^\d{17,20}$/.test(t.closedBy) ? `<@${t.closedBy}>` : tr('Sistema'),
        inline: true,
      },
      { name: tr('Encerrado em'), value: date(t.closedAt || Date.now()), inline: true },
      {
        name: tr('Duração'),
        value: `${Math.max(0, Math.floor(((t.closedAt || Date.now()) - t.createdAt) / 60000))} min`,
        inline: true,
      },
      { name: tr('Motivo do encerramento'), value: escapeMarkdown(t.reason || '—').slice(0, 1024) },
    )
    if (t.staffThreadId)
      embed.addFields({ name: tr('Equipe interna'), value: tr('Tópico trancado e arquivado') })
  }
  embed.setFooter({ text: `Branilist Bot · Ticket #${t.number}` }).setTimestamp(t.closedAt || t.createdAt)
  const components = closed
    ? [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket:transcript:${t.id}`)
            .setLabel(tr('Ver transcrição'))
            .setStyle(ButtonStyle.Secondary),
        ),
      ]
    : [ticketControls(t)]
  return { embeds: [embed], components, allowedMentions: { parse: [] } }
}
