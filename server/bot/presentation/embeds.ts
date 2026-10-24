import { escapeMarkdown, type APIEmbed } from 'discord.js'
import {
  mediaTitle,
  mediaURL,
  safeImage,
  type GuildSettings,
  type MediaCard,
} from '../../../shared/domain.js'
import { t } from '../../../shared/i18n.js'
import type { CommandResult } from '../core/types.js'
export function cleanText(value: string, limit = 500): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
}
export function embed(settings: GuildSettings, title: string, description?: string): APIEmbed {
  return {
    title: title.slice(0, 256),
    ...(description ? { description: description.slice(0, 4000) } : {}),
    color: Number.parseInt(settings.embedColor.slice(1), 16),
    footer: { text: 'Branilist Bot' },
  }
}
export function mediaEmbed(media: MediaCard, settings: GuildSettings): APIEmbed {
  const locale = settings.locale
  return {
    ...embed(
      settings,
      mediaTitle(media, settings.titleLanguage),
      settings.showDescriptions
        ? escapeMarkdown(
            cleanText(media.description || t(locale, 'noDescription'), settings.compactResults ? 160 : 650),
          )
        : undefined,
    ),
    url: mediaURL(media),
    ...(settings.showCovers && safeImage(media.coverImage)
      ? { thumbnail: { url: safeImage(media.coverImage)! } }
      : {}),
    fields: [
      {
        name: media.type === 'ANIME' ? t(locale, 'episodes') : t(locale, 'chapters'),
        value: String((media.type === 'ANIME' ? media.episodes : media.chapters) ?? '—'),
        inline: true,
      },
      {
        name: t(locale, 'score'),
        value: media.averageScore === null ? '—' : `${media.averageScore}/100`,
        inline: true,
      },
      { name: 'ID', value: media.id, inline: true },
    ],
  }
}
export function mediaList(items: MediaCard[], settings: GuildSettings, title: string): CommandResult {
  if (!items.length) return { content: t(settings.locale, 'emptySearch') }
  return {
    embeds: [
      embed(
        settings,
        title,
        items
          .slice(0, 8)
          .map(
            (m) =>
              `**[${escapeMarkdown(mediaTitle(m, settings.titleLanguage).slice(0, 120))}](${mediaURL(m)})**\n${m.type} · ${m.seasonYear ?? '—'} · ID ${m.id}`,
          )
          .join('\n\n'),
      ),
    ],
    link: { label: t(settings.locale, 'openBranilist'), url: mediaURL(items[0]!) },
  }
}
