import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type APIContainerComponent,
} from 'discord.js'
import { mediaTitle, safeImage, type GuildSettings, type MediaCard } from '../../../../shared/domain.js'
import { t } from '../../../../shared/i18n.js'
import { statuses, text } from './shared.js'
import { mediaChoiceValue } from './identifiers.js'
export const SEARCH_PAGE_SIZE = 5
export interface SearchPageView {
  query: string
  offset: number
  token: string
  hasNextPage: boolean
}
export function mediaSearchComponents(
  items: MediaCard[],
  settings: GuildSettings,
  view: SearchPageView,
): APIContainerComponent[] {
  const locale = settings.locale
  const container = new ContainerBuilder().setAccentColor(Number.parseInt(settings.embedColor.slice(1), 16))
  const visible = items.slice(0, SEARCH_PAGE_SIZE)
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ${t(locale, 'searchResults')}\n**${text(view.query, 200)}**\n${t(locale, 'searchSummary', { count: visible.length, page: view.offset / SEARCH_PAGE_SIZE + 1 })}`,
    ),
  )
  const metadata = (m: MediaCard) =>
    `${[m.format === 'MANGA' ? t(locale, 'mediaManga') : text(m.format, 40), m.seasonYear].filter(Boolean).join(' · ')}\n${t(locale, statuses[m.status] ?? 'statusUnknown')}`
  visible.forEach((media, index) => {
    if (index) container.addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    const fields = [
      new TextDisplayBuilder().setContent(`**${text(mediaTitle(media, settings.titleLanguage), 120)}**`),
      new TextDisplayBuilder().setContent(metadata(media)),
    ]
    const cover = settings.showCovers ? safeImage(media.coverImage) : undefined
    if (cover)
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(...fields)
          .setThumbnailAccessory(
            new ThumbnailBuilder()
              .setURL(cover)
              .setDescription(text(mediaTitle(media, settings.titleLanguage), 180)),
          ),
      )
    else container.addTextDisplayComponents(...fields)
  })
  if (visible.length) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`media:select:${view.token}`)
      .setPlaceholder(t(locale, 'selectMedia'))
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        visible.map((m) => ({
          label: mediaTitle(m, settings.titleLanguage).replace(/\s+/g, ' ').trim().slice(0, 100) || m.id,
          value: mediaChoiceValue(m.id),
          description: metadata(m).replace(/\n/g, ' · ').slice(0, 100),
        })),
      )
    container
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select))
  } else container.addTextDisplayComponents(new TextDisplayBuilder().setContent(t(locale, 'emptySearch')))
  if (view.offset > 0 || view.hasNextPage)
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`media:prev:${view.token}`)
          .setStyle(ButtonStyle.Secondary)
          .setLabel(t(locale, 'previous'))
          .setDisabled(view.offset === 0),
        new ButtonBuilder()
          .setCustomId(`media:next:${view.token}`)
          .setStyle(ButtonStyle.Secondary)
          .setLabel(t(locale, 'next'))
          .setDisabled(!view.hasNextPage),
      ),
    )
  return [container.toJSON()]
}
