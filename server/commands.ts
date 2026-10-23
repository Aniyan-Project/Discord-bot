import { z } from 'zod'
import { escapeMarkdown, type APIEmbed, type APIContainerComponent } from 'discord.js'
import { mediaDetailComponents, selectedMediaId } from './media-message.js'
import {
  commandIds,
  defaultSettings,
  guildSettingsSchema,
  mediaTitle,
  mediaURL,
  safeImage,
  type CommandId,
  type GuildSettings,
  type Locale,
  type MediaCard,
} from '../shared/domain.js'
import { commandDescriptions, t, type MessageKey } from '../shared/i18n.js'
import { AppError, randomToken } from './security.js'
import { Cooldowns } from './parser.js'
import type { Store } from './store.js'
import type { BranilistService } from './branilist.js'
import type { Config } from './config.js'
export interface Invocation {
  userId: string
  guildId?: string
  channelId: string
  parentChannelId?: string | null
  locale: Locale
  manageGuild: boolean
  source: 'slash' | 'prefix'
}
export interface CommandResult {
  componentsV2?: APIContainerComponent[]
  embeds?: APIEmbed[]
  content?: string
  private?: boolean
  link?: { label: string; url: string }
  confirm?: { token: string; label: string; cancel: string }
}
interface Pending {
  userId: string
  guildId?: string
  context: Invocation
  mediaId?: string
  command: 'remove' | 'disconnect'
  until: number
  locale: Locale
}
const idSchema = z.string().regex(/^[1-9]\d{0,19}$/)
const statusSchema = z.enum(['PLANNING', 'CURRENT', 'COMPLETED', 'PAUSED', 'DROPPED'])
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
export class CommandEngine {
  private readonly cooldowns = new Cooldowns()
  private readonly pending = new Map<string, Pending>()
  constructor(
    private readonly config: Config,
    private readonly store: Store,
    private readonly api: BranilistService,
  ) {}
  settings(ctx: Invocation): GuildSettings {
    return ctx.guildId
      ? this.store.settings(ctx.guildId).settings
      : { ...defaultSettings, locale: ctx.locale }
  }
  private enforce(ctx: Invocation, command: CommandId, cooldown = true): GuildSettings {
    const settings = this.settings(ctx)
    if (
      ctx.guildId &&
      (settings.disabledCommands.includes(command) ||
        (ctx.source === 'prefix' && !settings.prefixEnabled) ||
        (ctx.source === 'slash' && !settings.slashEnabled))
    )
      throw new AppError(403, 'disabled')
    if (
      ctx.guildId &&
      command !== 'settings' &&
      settings.allowedChannelIds.length &&
      !settings.allowedChannelIds.includes(ctx.channelId) &&
      !settings.allowedChannelIds.includes(ctx.parentChannelId ?? '')
    )
      throw new AppError(403, 'wrongChannel')
    if (cooldown) {
      const remaining = this.cooldowns.check(`${ctx.guildId ?? 'dm'}:${ctx.userId}`, settings.cooldownSeconds)
      if (remaining) throw new AppError(429, `cooldown:${remaining}`)
    }
    return settings
  }
  private embed(settings: GuildSettings, title: string, description?: string): APIEmbed {
    return {
      title: title.slice(0, 256),
      ...(description ? { description: description.slice(0, 4000) } : {}),
      color: Number.parseInt(settings.embedColor.slice(1), 16),
      footer: { text: 'Branilist Bot' },
    }
  }
  private mediaEmbed(media: MediaCard, settings: GuildSettings): APIEmbed {
    const locale = settings.locale
    return {
      ...this.embed(
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
  private mediaList(items: MediaCard[], settings: GuildSettings, title: string): CommandResult {
    if (!items.length) return { content: t(settings.locale, 'emptySearch') }
    return {
      embeds: [
        this.embed(
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
  private confirmation(ctx: Invocation, command: 'remove' | 'disconnect', mediaId?: string): CommandResult {
    for (const [key, value] of this.pending) if (value.until <= Date.now()) this.pending.delete(key)
    if (this.pending.size > 5000) throw new AppError(429, 'rateLimited')
    const token = randomToken()
    this.pending.set(token, {
      userId: ctx.userId,
      guildId: ctx.guildId,
      context: { ...ctx },
      mediaId,
      command,
      until: Date.now() + 5 * 60000,
      locale: this.settings(ctx).locale,
    })
    const locale = this.settings(ctx).locale
    return {
      private: true,
      content: t(locale, command === 'remove' ? 'confirmRemove' : 'unlinkConfirm'),
      confirm: { token, label: t(locale, 'confirm'), cancel: t(locale, 'cancel') },
    }
  }
  pendingGuild(token: string): string | undefined {
    return this.pending.get(token)?.guildId
  }
  actionContext(token: string, userId: string): Invocation {
    const action = this.pending.get(token)
    if (!action || action.until <= Date.now()) throw new AppError(410, 'expired')
    if (action.userId !== userId) throw new AppError(403, 'ownButtonOnly')
    return { ...action.context }
  }
  async confirm(token: string, ctx: Invocation, cancel = false): Promise<CommandResult> {
    const action = this.pending.get(token)
    if (!action || action.until <= Date.now()) throw new AppError(410, 'expired')
    if (action.userId !== ctx.userId) throw new AppError(403, 'ownButtonOnly')
    this.pending.delete(token)
    if (cancel) return { content: t(action.locale, 'cancel'), private: true }
    this.enforce(action.context, action.command, false)
    if (action.command === 'remove') await this.api.remove(ctx.userId, action.mediaId!)
    else await this.api.unlink(ctx.userId)
    if (action.guildId) this.store.event(action.guildId, action.command, true)
    return { content: t(action.locale, action.command === 'remove' ? 'removed' : 'notLinked'), private: true }
  }
  async execute(command: CommandId, args: string[], ctx: Invocation): Promise<CommandResult> {
    const settings = this.enforce(ctx, command)
    const locale = settings.locale
    try {
      let result: CommandResult
      switch (command) {
        case 'anime':
        case 'manga': {
          const query = z.string().trim().min(1).max(150).parse(args.join(' '))
          const selectedId = ctx.source === 'slash' ? selectedMediaId(query) : undefined
          if (selectedId) {
            const media = await this.api.mediaDetail(selectedId)
            if (media.type !== (command === 'anime' ? 'ANIME' : 'MANGA')) throw new AppError(404, 'notFound')
            result = { componentsV2: mediaDetailComponents(media, settings) }
            break
          }
          const items = (await this.api.search(query, command === 'anime' ? 'ANIME' : 'MANGA')).nodes
          result =
            items.length === 1
              ? { componentsV2: mediaDetailComponents(await this.api.mediaDetail(items[0]!.id), settings) }
              : this.mediaList(items, settings, t(locale, command))
          break
        }
        case 'media': {
          const id = idSchema.parse(args[0])
          const provider = z.enum(['branilist', 'mal', 'anilist']).parse(args[1] || 'branilist')
          result = { embeds: [this.mediaEmbed(await this.api.media(id, provider), settings)] }
          break
        }
        case 'trending': {
          const type = z.enum(['ANIME', 'MANGA']).parse((args[0] || 'ANIME').toUpperCase())
          result = this.mediaList(await this.api.trending(type), settings, t(locale, 'trending'))
          break
        }
        case 'profile': {
          const username = args[0] ? z.string().min(1).max(64).parse(args[0]) : undefined
          const profile = await this.api.profile(ctx.userId, username)
          result = {
            private: !username,
            embeds: [
              {
                ...this.embed(
                  settings,
                  profile.displayName,
                  escapeMarkdown(cleanText(profile.bio || '—', 600)),
                ),
                url: `https://branilist.com/user/${encodeURIComponent(profile.username)}`,
                ...(safeImage(profile.avatarUrl)
                  ? { thumbnail: { url: safeImage(profile.avatarUrl)! } }
                  : {}),
                fields: [
                  { name: 'Username', value: escapeMarkdown(profile.username), inline: true },
                  { name: 'ID', value: profile.id, inline: true },
                ],
              },
            ],
          }
          break
        }
        case 'library': {
          const status = args[0] ? statusSchema.parse(args[0].toUpperCase()) : undefined
          const page = z.coerce
            .number()
            .int()
            .min(1)
            .max(834)
            .parse(args[1] || 1)
          const list = await this.api.library(ctx.userId, (page - 1) * 12, status)
          result = {
            private: true,
            embeds: [
              this.embed(
                settings,
                t(locale, 'library'),
                list.nodes.length
                  ? list.nodes
                      .map(
                        (e) =>
                          `**${escapeMarkdown(e.media ? mediaTitle(e.media, settings.titleLanguage) : e.mediaId)}**\n${t(locale, e.status)} · ${t(locale, 'progress')}: ${e.progress} · ID ${e.mediaId}`,
                      )
                      .join('\n\n')
                  : t(locale, 'emptyLibrary'),
              ),
            ],
            ...(list.pageInfo.hasNextPage
              ? { content: `${t(locale, 'next')}: /library ${status || ''} ${page + 1}` }
              : {}),
          }
          break
        }
        case 'progress': {
          const mediaId = idSchema.parse(args[0])
          const progress = z.coerce.number().int().min(0).max(100000).parse(args[1])
          const status = args[2] ? statusSchema.parse(args[2].toUpperCase()) : undefined
          await this.api.progress(ctx.userId, mediaId, progress, status)
          result = { private: true, content: t(locale, 'progressSaved') }
          break
        }
        case 'remove': {
          if (!this.config.DEMO_MODE && !this.store.account(ctx.userId))
            throw new AppError(401, 'linkRequired')
          result = this.confirmation(ctx, 'remove', idSchema.parse(args[0]))
          break
        }
        case 'disconnect':
          result = this.confirmation(ctx, 'disconnect')
          break
        case 'favourites':
          result = {
            ...this.mediaList(await this.api.favourites(ctx.userId), settings, t(locale, 'favourites')),
            private: true,
          }
          break
        case 'collections': {
          const list = await this.api.collections(ctx.userId)
          result = {
            private: true,
            embeds: [
              this.embed(
                settings,
                t(locale, 'collections'),
                list
                  .map((c) => `**${escapeMarkdown(c.name)}** · ${c.itemCount} · ${c.visibility}`)
                  .join('\n\n') || t(locale, 'noData'),
              ),
            ],
          }
          break
        }
        case 'connect':
          result = {
            private: true,
            content: t(locale, 'accountBody'),
            link: {
              label: t(locale, 'linkAccount'),
              url: `${this.config.APP_URL}/dashboard/account?lang=${locale}`,
            },
          }
          break
        case 'settings': {
          if (!ctx.guildId || !ctx.manageGuild) throw new AppError(403, 'forbidden')
          const updated = await this.store.withGuildLock(ctx.guildId, async () => {
            const before = this.store.settings(ctx.guildId!)
            const updated = { ...before.settings }
            for (let i = 0; i < args.length; i += 2) {
              if (args[i] === 'prefix') updated.prefix = args[i + 1] ?? ''
              else if (args[i] === 'locale' || args[i] === 'language')
                updated.locale = z.enum(['pt-BR', 'en', 'es']).parse(args[i + 1])
              else throw new AppError(400, 'invalidInput')
            }
            if (args.length)
              this.store.saveSettings(
                ctx.guildId!,
                guildSettingsSchema.parse(updated),
                before.revision,
                ctx.userId,
              )
            return updated
          })
          result = {
            private: true,
            content: `${t(updated.locale, 'prefix')}: ${updated.prefix}\n${t(updated.locale, 'language')}: ${updated.locale}`,
            link: {
              label: t(locale, 'configuration'),
              url: `${this.config.APP_URL}/dashboard/${ctx.guildId}/settings`,
            },
          }
          break
        }
        case 'help':
          result = {
            embeds: [
              this.embed(
                settings,
                t(locale, 'commands'),
                commandIds
                  .filter((id) => !settings.disabledCommands.includes(id))
                  .map((id) => `**/${id}** · ${t(locale, commandDescriptions[id])}`)
                  .join('\n'),
              ),
            ],
          }
          break
        case 'ping':
          result = { content: 'Pong! 🏓' }
          break
      }
      if (ctx.guildId && !result.confirm) this.store.event(ctx.guildId, command, true)
      return result
    } catch (error) {
      if (ctx.guildId) this.store.event(ctx.guildId, command, false)
      if (error instanceof z.ZodError) throw new AppError(400, 'invalidInput')
      throw error
    }
  }
}
