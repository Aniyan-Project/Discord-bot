import { z } from 'zod'
export const locales = ['pt-BR', 'en', 'es'] as const
export type Locale = (typeof locales)[number]
export const commandIds = [
  'anime',
  'manga',
  'media',
  'trending',
  'profile',
  'library',
  'progress',
  'remove',
  'favourites',
  'collections',
  'connect',
  'disconnect',
  'settings',
  'help',
  'ping',
] as const
export type CommandId = (typeof commandIds)[number]
export const guildSettingsSchema = z
  .object({
    prefix: z
      .string()
      .trim()
      .min(1)
      .max(8)
      .refine((s) => !/[\s@<>`\\]/u.test(s), 'Invalid prefix'),
    locale: z.enum(locales),
    prefixEnabled: z.boolean(),
    slashEnabled: z.boolean(),
    nickname: z.string().trim().max(32),
    embedColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    titleLanguage: z.enum(['romaji', 'english', 'portuguese', 'native']),
    cooldownSeconds: z.number().int().min(2).max(60),
    allowedChannelIds: z.array(z.string().regex(/^\d{17,20}$/)).max(25),
    disabledCommands: z.array(z.enum(commandIds)).max(commandIds.length),
    showDescriptions: z.boolean(),
    showCovers: z.boolean(),
    compactResults: z.boolean(),
  })
  .strict()
  .refine((v) => v.prefixEnabled || v.slashEnabled, 'Enable at least one command mode')
export type GuildSettings = z.infer<typeof guildSettingsSchema>
export const defaultSettings: GuildSettings = {
  prefix: 'b!',
  locale: 'pt-BR',
  prefixEnabled: true,
  slashEnabled: true,
  nickname: '',
  embedColor: '#FF9955',
  titleLanguage: 'romaji',
  cooldownSeconds: 5,
  allowedChannelIds: [],
  disabledCommands: [],
  showDescriptions: true,
  showCovers: true,
  compactResults: false,
}
export function normalizeLocale(value?: string | null): Locale {
  return value?.toLowerCase().startsWith('es') ? 'es' : value?.toLowerCase().startsWith('en') ? 'en' : 'pt-BR'
}
export interface MediaCard {
  id: string
  slug: string
  type: 'ANIME' | 'MANGA'
  title: { romaji: string; english: string | null; portuguese: string | null; native: string | null }
  description: string | null
  coverImage: string | null
  bannerImage: string | null
  episodes: number | null
  chapters: number | null
  averageScore: number | null
  seasonYear: number | null
  status: string
  format: string
  isAdult: boolean
  genres?: string[]
  relations?: Array<{
    type: string
    media: Pick<MediaCard, 'id' | 'slug' | 'type' | 'title'>
  }>
  hasMoreRelations?: boolean
}
export interface ProfileCard {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
  createdAt: string
}
export interface GuildSummary {
  id: string
  name: string
  icon: string | null
  installed: boolean
  memberCount?: number
}
export interface UserInfo {
  id: string
  username: string
  avatar: string | null
}
export interface LinkedAccount {
  username: string
  displayName: string
  avatarUrl: string | null
  scopes: string[]
}
export interface SessionView {
  user: UserInfo | null
  csrfToken: string | null
  linked: LinkedAccount | null
  demo: boolean
  configured: { discord: boolean; branilist: boolean; catalog: boolean }
  inviteUrl: string | null
  supportUrl: string
}
export function mediaTitle(
  media: Pick<MediaCard, 'title'>,
  language: GuildSettings['titleLanguage'],
): string {
  return media.title[language] || media.title.romaji
}
export function mediaURL(media: Pick<MediaCard, 'slug' | 'type'>): string {
  const slug = encodeURIComponent(media.slug).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `https://branilist.com/${media.type === 'MANGA' ? 'manga' : 'anime'}/${slug}`
}
export function safeImage(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : undefined
  } catch {
    return undefined
  }
}
