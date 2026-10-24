import {
  ChannelType,
  PermissionFlagsBits as P,
  Routes,
  REST,
  type Client,
  type Guild,
  type GuildMember,
  type TextChannel,
  type NewsChannel,
} from 'discord.js'
import type { Locale, UserInfo } from '../../../shared/domain.js'
import {
  parseStudioDraft,
  studioPayload,
  studioTime,
  validateStudioPayload,
  type StudioDraft,
  type StudioVariables,
} from '../../../shared/message-studio.js'
import { AppError } from '../../security.js'

type Destination = TextChannel | NewsChannel
export class MessageStudio {
  private readonly webhookREST: Pick<REST, 'post'>
  constructor(
    private readonly client: Client,
    private readonly demo: boolean,
    webhookREST?: Pick<REST, 'post'>,
  ) {
    // A webhook has no nonce deduplication. Do not retry ambiguous 5xx/network failures.
    this.webhookREST = webhookREST ?? new REST({ version: '10', retries: 0, timeout: 15000 })
  }
  close() {
    if (this.webhookREST instanceof REST) {
      this.webhookREST.clearHashSweeper()
      this.webhookREST.clearHandlerSweeper()
    }
  }
  private async guild(id: string): Promise<Guild> {
    if (!this.client.guilds.cache.has(id) || !this.client.isReady()) throw new AppError(409, 'notInstalled')
    return this.client.guilds.fetch({ guild: id, force: true, withCounts: true })
  }
  private async actors(guild: Guild, userId: string) {
    const [actor, bot] = await Promise.all([
      guild.members.fetch({ user: userId, force: true }),
      guild.members.fetchMe({ force: true }),
    ]).catch(() => {
      throw new AppError(403, 'forbidden')
    })
    if (!actor.permissions.has(P.ManageGuild)) throw new AppError(403, 'forbidden')
    return { actor, bot }
  }
  private permitted(channel: Destination, actor: GuildMember, bot: GuildMember) {
    return (
      channel.permissionsFor(actor)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks]) &&
      channel.permissionsFor(bot)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])
    )
  }
  async context(
    id: string,
    user: UserInfo,
    locale: Locale,
  ): Promise<{
    variables: StudioVariables
    channels: Array<{ id: string; name: string; webhook: boolean }>
  }> {
    if (this.demo)
      return {
        variables: {
          server: 'Aniyan Project: Hub',
          serverId: id,
          serverIcon: '',
          memberCount: '128',
          channel: 'anime-e-manga',
          channelId: '1200000000000000001',
          user: user.username,
          userId: user.id,
          userMention: `<@${user.id}>`,
          userAvatar: user.avatar ?? '',
          ...studioTime(locale),
        },
        channels: [
          { id: '1200000000000000001', name: 'anime-e-manga', webhook: true },
          { id: '1200000000000000002', name: 'comandos-do-bot', webhook: true },
          { id: '1200000000000000003', name: 'conversa-geral', webhook: false },
        ],
      }
    const guild = await this.guild(id)
    const { actor, bot } = await this.actors(guild, user.id)
    const channels = await guild.channels.fetch()
    return {
      variables: {
        server: guild.name,
        serverId: id,
        serverIcon: guild.iconURL({ size: 256 }) ?? '',
        memberCount: String(guild.approximateMemberCount ?? guild.memberCount),
        channel: '',
        channelId: '',
        user: actor.displayName,
        userId: user.id,
        userMention: `<@${user.id}>`,
        userAvatar: actor.displayAvatarURL({ size: 256 }),
        ...studioTime(locale),
      },
      channels: [...channels.values()]
        .filter(
          (c): c is Destination =>
            !!c &&
            (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
            !!this.permitted(c, actor, bot),
        )
        .map((c) => ({
          id: c.id,
          name: c.name,
          webhook:
            !!c.permissionsFor(actor)?.has(P.ManageWebhooks) &&
            !!c.permissionsFor(bot)?.has(P.ManageWebhooks),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }
  }
  async send(id: string, user: UserInfo, locale: Locale, input: StudioDraft, requestId: string) {
    const draft = parseStudioDraft(input)
    const context = await this.context(id, user, locale)
    const destination = context.channels.find((c) => c.id === draft.channelId)
    if (!destination) throw new AppError(403, 'studioChannelDenied')
    if (draft.sender.type === 'webhook' && !destination.webhook)
      throw new AppError(403, 'studioWebhookDenied')
    const variables: StudioVariables = {
      ...context.variables,
      channel: destination.name,
      channelId: destination.id,
    }
    let payload
    try {
      payload = studioPayload(draft, variables)
      if (validateStudioPayload(payload).length) throw Error('invalid')
    } catch {
      throw new AppError(400, 'studioInvalidMessage')
    }
    if (this.demo) return { id: 'demo', url: null, demo: true }
    const guild = await this.guild(id)
    const { actor, bot } = await this.actors(guild, user.id)
    const raw = await guild.channels.fetch(destination.id)
    if (
      !raw ||
      (raw.type !== ChannelType.GuildText && raw.type !== ChannelType.GuildAnnouncement) ||
      !this.permitted(raw, actor, bot)
    )
      throw new AppError(403, 'studioChannelDenied')
    if (
      draft.mentions.some((v) => v === 'everyone' || v === 'roles') &&
      !raw.permissionsFor(actor)?.has(P.MentionEveryone)
    )
      throw new AppError(403, 'studioMentionDenied')
    try {
      let result: { id: string }
      if (draft.sender.type === 'webhook') {
        if (
          !raw.permissionsFor(actor)?.has(P.ManageWebhooks) ||
          !raw.permissionsFor(bot)?.has(P.ManageWebhooks)
        )
          throw new AppError(403, 'studioWebhookDenied')
        const hooks = await raw.fetchWebhooks()
        // Never use another application's or a manually created webhook.
        const hook =
          hooks.find(
            (h) => h.owner?.id === this.client.user!.id && h.name === 'Branilist Bot · Studio' && !!h.token,
          ) ??
          (await raw.createWebhook({
            name: 'Branilist Bot · Studio',
            reason: `Message Studio by ${user.id}`,
          }))
        if (!hook.token) throw new AppError(502, 'requestFailed')
        result = (await this.webhookREST.post(Routes.webhook(hook.id, hook.token), {
          auth: false,
          query: new URLSearchParams({ wait: 'true', with_components: 'true' }),
          body: payload,
        })) as { id: string }
      } else {
        const { username: _name, avatar_url: _avatar, ...body } = payload
        result = (await this.client.rest.post(Routes.channelMessages(destination.id), {
          body: { ...body, nonce: requestId.replaceAll('-', '').slice(0, 25), enforce_nonce: true },
        })) as { id: string }
      }
      return {
        id: result.id,
        url: `https://discord.com/channels/${id}/${destination.id}/${result.id}`,
        demo: false,
      }
    } catch (error) {
      if (error instanceof AppError) throw error
      // Do not leak raw Discord errors, webhook URLs or tokens to logs/UI.
      const code = error && typeof error === 'object' && 'code' in error ? Number(error.code) : 0
      if ([50001, 50013].includes(code)) throw new AppError(403, 'studioChannelDenied')
      if (code === 50035) throw new AppError(400, 'studioInvalidMessage')
      throw new AppError(502, 'studioDeliveryUncertain')
    }
  }
}
