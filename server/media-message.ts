import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  escapeMarkdown,
  type APIContainerComponent,
} from 'discord.js'
import { mediaTitle, mediaURL, safeImage, type GuildSettings, type MediaCard } from '../shared/domain.js'
import { t, type MessageKey } from '../shared/i18n.js'

const statuses: Record<string, MessageKey> = {
  FINISHED: 'statusFinished',
  RELEASING: 'statusReleasing',
  NOT_YET_RELEASED: 'statusUpcoming',
  CANCELLED: 'statusCancelled',
  HIATUS: 'statusHiatus',
  UPCOMING: 'statusUpcoming',
}
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
const relationLabels: Record<string, MessageKey> = {
  PREQUEL: 'relationPrequel',
  SEQUEL: 'relationSequel',
  SOURCE: 'relationSource',
  ADAPTATION: 'relationAdaptation',
  SIDE_STORY: 'relationSideStory',
  ALTERNATIVE: 'relationAlternative',
  SUMMARY: 'relationSummary',
  CHARACTER: 'relationCharacter',
  PARENT: 'relationParent',
  SPIN_OFF: 'relationSpinOff',
  OTHER: 'relationOther',
}
const relationOrder: Record<string, number> = {
  PREQUEL: 0,
  SEQUEL: 1,
  SOURCE: 2,
  ADAPTATION: 3,
  PARENT: 4,
  SIDE_STORY: 5,
  SPIN_OFF: 6,
}

// Share this marker between autocomplete and execution. Titles remain display-only.
export function mediaChoiceValue(mediaId: string): string {
  return `branilist:${mediaId}`
}
export function selectedMediaId(value: string): string | undefined {
  return /^branilist:([1-9]\d{0,19})$/.exec(value)?.[1]
}
function text(value: string, max: number): string {
  return escapeMarkdown(
    value
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim(),
  ).slice(0, max)
}
export function mediaDetailComponents(media: MediaCard, settings: GuildSettings): APIContainerComponent[] {
  const locale = settings.locale
  const tr = (key: MessageKey) => t(locale, key)
  const title = text(mediaTitle(media, settings.titleLanguage), 180)
  const amount = media.type === 'ANIME' ? media.episodes : media.chapters
  const facts = [
    media.format === 'MANGA' ? tr('mediaManga') : text(media.format, 40),
    media.seasonYear,
    `${amount ?? '—'} ${tr(media.type === 'ANIME' ? 'episodes' : 'chapters').toLocaleLowerCase(locale)}`,
  ]
    .filter(Boolean)
    .join(' · ')
  const metadata = [
    new TextDisplayBuilder().setContent(`## ${title}`),
    new TextDisplayBuilder().setContent(facts),
    new TextDisplayBuilder().setContent(
      `**${tr('mediaStatus')}:** ${tr(statuses[media.status] ?? 'statusUnknown')}\n**${tr('score')}:** ${media.averageScore === null ? '—' : `${media.averageScore}/100`}`,
    ),
  ]
  const container = new ContainerBuilder().setAccentColor(Number.parseInt(settings.embedColor.slice(1), 16))
  const cover = settings.showCovers ? safeImage(media.coverImage) : undefined
  if (cover)
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(...metadata)
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(cover)
            .setDescription(text(mediaTitle(media, settings.titleLanguage), 180)),
        ),
    )
  else container.addTextDisplayComponents(...metadata)
  if (media.genres?.length)
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**${tr('mediaGenres')}**\n${media.genres
          .slice(0, 15)
          .map((g) => text(g, 40))
          .join(' · ')}`,
      ),
    )
  if (settings.showDescriptions)
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**${tr('mediaSynopsis')}**\n${text(media.description || tr('noDescription'), settings.compactResults ? 160 : 650)}`,
      ),
    )
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(tr('openBranilist')).setURL(mediaURL(media)),
    ),
  )
  const relations = [...(media.relations ?? [])].sort(
    (a, b) => (relationOrder[a.type] ?? 9) - (relationOrder[b.type] ?? 9),
  )
  if (relations.length) {
    const visible = relations.slice(0, 6)
    const candidates = visible.map(
      (r) =>
        `**${tr(relationLabels[r.type] ?? 'relationOther')}**\n[${text(mediaTitle(r.media, settings.titleLanguage), 100)}](${mediaURL(r.media)}) · ${tr(r.media.type === 'ANIME' ? 'mediaAnime' : 'mediaManga')}`,
    )
    // Reserve space for the relation heading and link within Discord's total text limit.
    let budget = Math.max(0, 3600 - JSON.stringify(container.toJSON()).length)
    const lines: string[] = []
    for (const line of candidates) {
      if (line.length > budget) break
      lines.push(line)
      budget -= line.length + 2
    }
    if (relations.length > lines.length || media.hasMoreRelations)
      lines.push(`[${tr('moreRelations')}](${mediaURL(media)})`)
    container
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ${tr('mediaRelations')}\n${lines.join('\n\n')}`),
      )
  }
  return [container.toJSON()]
}
