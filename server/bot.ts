import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type APIEmbed,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
} from 'discord.js'
import type { Config } from './config.js'
import type { Store } from './store.js'
import type { BranilistService } from './branilist.js'
import { CommandEngine, type CommandResult, type Invocation } from './commands.js'
import { parsePrefix } from './parser.js'
import { AppError } from './security.js'
import { commandIds, normalizeLocale, mediaTitle, type CommandId, type Locale } from '../shared/domain.js'
import { hasMessage, t } from '../shared/i18n.js'
import { mediaChoiceValue } from './media-message.js'
const privateCommands = new Set<CommandId>([
  'library',
  'progress',
  'remove',
  'favourites',
  'collections',
  'connect',
  'disconnect',
  'settings',
])
export function errorMessage(error: unknown, locale: Locale): string {
  if (error instanceof AppError && error.code.startsWith('cooldown:'))
    return t(locale, 'cooldownError', { seconds: error.code.split(':')[1]! })
  return t(locale, error instanceof AppError && hasMessage(error.code) ? error.code : 'requestFailed')
}
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
function slashArgs(i: ChatInputCommandInteraction): string[] {
  switch (i.commandName) {
    case 'anime':
    case 'manga':
      return [i.options.getString('query', true)]
    case 'media':
      return [i.options.getString('id', true), i.options.getString('provider') || 'branilist']
    case 'trending':
      return [i.options.getString('type') || 'ANIME']
    case 'profile':
      return i.options.getString('username') ? [i.options.getString('username')!] : []
    case 'library':
      return [i.options.getString('status') || '', String(i.options.getInteger('page') || 1)]
    case 'progress':
      return [
        i.options.getString('media_id', true),
        String(i.options.getInteger('value', true)),
        i.options.getString('status') || '',
      ]
    case 'remove':
      return [i.options.getString('media_id', true)]
    case 'settings':
      return [
        ...(i.options.getString('prefix') ? ['prefix', i.options.getString('prefix')!] : []),
        ...(i.options.getString('language') ? ['language', i.options.getString('language')!] : []),
      ]
    default:
      return []
  }
}
export class BotRuntime {
  readonly client: Client
  readonly engine: CommandEngine
  private lastAutocomplete = new Map<string, number>()
  constructor(
    readonly config: Config,
    private readonly store: Store,
    private readonly api: BranilistService,
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        ...(config.ENABLE_MESSAGE_CONTENT
          ? [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
          : []),
      ],
      allowedMentions: { parse: [], repliedUser: false },
      failIfNotExists: false,
    })
    this.engine = new CommandEngine(config, store, api)
    this.client.on(Events.Error, () =>
      console.error('Discord connection error; the client will attempt recovery.'),
    )
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isChatInputCommand()) await this.slash(interaction)
      else if (interaction.isAutocomplete()) await this.autocomplete(interaction)
      else if (interaction.isButton() && /^(confirm|cancel):/.test(interaction.customId)) {
        const [action, token] = interaction.customId.split(':')
        if (!token) return
        const guildId = this.engine.pendingGuild(token)
        const locale = guildId ? store.settings(guildId).settings.locale : normalizeLocale(interaction.locale)
        try {
          const context = this.engine.actionContext(token, interaction.user.id)
          await interaction.deferUpdate()
          const result = await this.engine.confirm(token, context, action === 'cancel')
          await interaction.editReply(payload(result))
        } catch (error) {
          if (interaction.deferred)
            await interaction
              .followUp({ content: errorMessage(error, locale), flags: MessageFlags.Ephemeral })
              .catch(() => undefined)
          else
            await interaction
              .reply({ content: errorMessage(error, locale), flags: MessageFlags.Ephemeral })
              .catch(() => undefined)
        }
      }
    })
    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot || !message.guildId || !config.ENABLE_MESSAGE_CONTENT) return
      const settings = store.settings(message.guildId).settings
      if (!settings.prefixEnabled || !message.content.startsWith(settings.prefix)) return
      try {
        const parsed = parsePrefix(message.content, settings.prefix)
        if (!parsed) return
        const context: Invocation = {
          userId: message.author.id,
          guildId: message.guildId,
          channelId: message.channelId,
          parentChannelId: message.channel.isThread() ? message.channel.parentId : null,
          locale: settings.locale,
          source: 'prefix',
          manageGuild: message.member?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false,
        }
        const result = await this.engine.execute(parsed.command, parsed.args, context)
        if (result.private) {
          try {
            await message.author.send(payload(result))
            await message.react('✉️').catch(() => undefined)
          } catch {
            await message
              .reply({
                content: t(settings.locale, 'privateDMFailed'),
                allowedMentions: { parse: [], repliedUser: false },
              })
              .catch(() => undefined)
          }
        } else await message.reply(payload(result)).catch(() => undefined)
      } catch (error) {
        await message
          .reply({
            content: errorMessage(error, settings.locale),
            allowedMentions: { parse: [], repliedUser: false },
          })
          .catch(() => undefined)
      }
    })
  }
  private async slash(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!commandIds.includes(interaction.commandName as CommandId)) return
    const command = interaction.commandName as CommandId
    const locale = interaction.guildId
      ? this.store.settings(interaction.guildId).settings.locale
      : normalizeLocale(interaction.locale)
    const privateReply =
      privateCommands.has(command) || (command === 'profile' && !interaction.options.getString('username'))
    try {
      await interaction.deferReply(privateReply ? { flags: MessageFlags.Ephemeral } : {})
      const result = await this.engine.execute(command, slashArgs(interaction), {
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
  private async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!['anime', 'manga'].includes(interaction.commandName)) return
    const now = Date.now()
    const previous = this.lastAutocomplete.get(interaction.user.id) ?? 0
    if (now - previous < 1200) {
      await interaction.respond([]).catch(() => undefined)
      return
    }
    if (this.lastAutocomplete.size > 10000) this.lastAutocomplete.clear()
    this.lastAutocomplete.set(interaction.user.id, now)
    try {
      const query = interaction.options.getFocused()
      if (query.length < 2 || query.length > 150) {
        await interaction.respond([])
        return
      }
      const settings = interaction.guildId ? this.store.settings(interaction.guildId).settings : undefined
      if (
        settings &&
        (!settings.slashEnabled ||
          settings.disabledCommands.includes(interaction.commandName as CommandId) ||
          (settings.allowedChannelIds.length && !settings.allowedChannelIds.includes(interaction.channelId)))
      ) {
        await interaction.respond([])
        return
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 1800)
      })
      try {
        const result = await Promise.race([
          this.api.search(query, interaction.commandName === 'anime' ? 'ANIME' : 'MANGA'),
          timeout,
        ])
        await interaction.respond(
          result?.nodes.slice(0, 10).map((m) => ({
            name: mediaTitle(m, settings?.titleLanguage ?? 'romaji').slice(0, 100),
            value: mediaChoiceValue(m.id),
          })) ?? [],
        )
      } finally {
        clearTimeout(timer)
      }
    } catch {
      await interaction.respond([]).catch(() => undefined)
    }
  }
  installed(guildId: string): boolean {
    return this.config.DEMO_MODE || (this.client.isReady() && this.client.guilds.cache.has(guildId))
  }
  status() {
    return {
      online: this.config.DEMO_MODE ? false : this.client.isReady(),
      latency: this.client.isReady() ? Math.max(0, Math.round(this.client.ws.ping)) : null,
      servers: this.config.DEMO_MODE ? 1 : this.client.guilds.cache.size,
    }
  }
  async channels(guildId: string): Promise<Array<{ id: string; name: string }>> {
    if (this.config.DEMO_MODE)
      return [
        { id: '1200000000000000001', name: 'anime-e-manga' },
        { id: '1200000000000000002', name: 'comandos-do-bot' },
        { id: '1200000000000000003', name: 'conversa-geral' },
      ]
    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) throw new AppError(409, 'notInstalled')
    const channels = await guild.channels.fetch()
    return channels
      .filter(
        (c) =>
          c !== null &&
          c.isTextBased() &&
          !c.isThread() &&
          !!c
            .permissionsFor(guild.members.me!)
            ?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]),
      )
      .map((c) => ({ id: c!.id, name: c!.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  async nickname(guildId: string, value: string): Promise<void> {
    if (this.config.DEMO_MODE) return
    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) throw new AppError(409, 'notInstalled')
    try {
      const member = guild.members.me ?? (await guild.members.fetchMe())
      await member.setNickname(value || null)
    } catch {
      throw new AppError(403, 'forbidden')
    }
  }
  async start(): Promise<void> {
    if (!this.config.DEMO_MODE) await this.client.login(this.config.DISCORD_TOKEN)
  }
  async close(): Promise<void> {
    await this.client.destroy()
  }
}
