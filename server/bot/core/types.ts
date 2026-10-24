import type { APIContainerComponent, APIEmbed } from 'discord.js'
import type { GuildSettings, Locale } from '../../../shared/domain.js'
import type { BranilistService } from '../../branilist.js'
import type { Config } from '../../config.js'
import type { Store } from '../../store.js'
import type { ConfirmationSessions } from '../interactions/confirmations.js'
import type { MediaSearchSessions } from '../interactions/media-search.js'
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
export interface CommandContext {
  invocation: Invocation
  settings: GuildSettings
  config: Config
  store: Store
  api: BranilistService
  confirmations: ConfirmationSessions
  searches: MediaSearchSessions
}
