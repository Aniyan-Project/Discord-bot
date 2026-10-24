import type { GuildSettings, MediaCard } from '../../../shared/domain.js'
import type { BranilistService } from '../../branilist.js'
import { AppError, randomToken } from '../../security.js'
import { Cooldowns } from '../core/cooldowns.js'
import type { CommandPolicy } from '../core/policy.js'
import type { CommandResult, Invocation } from '../core/types.js'
import {
  mediaDetailComponents,
  mediaSearchComponents,
  SEARCH_PAGE_SIZE,
  selectedMediaId,
} from '../presentation/media/index.js'
interface SearchSession {
  context: Invocation
  command: 'anime' | 'manga'
  query: string
  offset: number
  ids: string[]
  hasNextPage: boolean
  until: number
  busy: boolean
}
export class MediaSearchSessions {
  private readonly searches = new Map<string, SearchSession>()
  private readonly searchCooldowns = new Cooldowns()
  constructor(
    private readonly api: BranilistService,
    private readonly policy: CommandPolicy,
  ) {}
  render(
    items: MediaCard[],
    query: string,
    command: 'anime' | 'manga',
    ctx: Invocation,
    settings: GuildSettings,
    offset: number,
    remoteHasNext: boolean,
    until = Date.now() + 5 * 60000,
  ): CommandResult {
    for (const [key, value] of this.searches) if (value.until <= Date.now()) this.searches.delete(key)
    if (this.searches.size >= 5000) throw new AppError(429, 'rateLimited')
    const token = randomToken()
    const visible = items
      .filter((m) => !m.isAdult && m.type === (command === 'anime' ? 'ANIME' : 'MANGA'))
      .slice(0, SEARCH_PAGE_SIZE)
    const hasNextPage =
      offset + SEARCH_PAGE_SIZE <= 10000 && (items.length > SEARCH_PAGE_SIZE || remoteHasNext)
    const componentsV2 = mediaSearchComponents(visible, settings, { query, offset, token, hasNextPage })
    this.searches.set(token, {
      context: { ...ctx },
      command,
      query,
      offset,
      ids: visible.map((m) => m.id),
      hasNextPage,
      until,
      busy: false,
    })
    return { componentsV2 }
  }
  searchContext(token: string, userId: string): Invocation {
    const session = this.searches.get(token)
    if (!session || session.until <= Date.now()) throw new AppError(410, 'expired')
    if (session.context.userId !== userId) throw new AppError(403, 'ownSearchOnly')
    return { ...session.context }
  }
  async interactSearch(
    token: string,
    ctx: Invocation,
    action: 'select' | 'prev' | 'next',
    value?: string,
  ): Promise<CommandResult> {
    const original = this.searchContext(token, ctx.userId)
    const session = this.searches.get(token)!
    if (ctx.guildId !== original.guildId || ctx.channelId !== original.channelId)
      throw new AppError(403, 'forbidden')
    const current = { ...original, parentChannelId: ctx.parentChannelId }
    const settings = this.policy.enforce(current, session.command, false)
    if (session.busy || this.searchCooldowns.check(`${original.guildId ?? 'dm'}:${ctx.userId}`, 1))
      throw new AppError(429, 'rateLimited')
    session.busy = true
    try {
      let result: CommandResult
      if (action === 'select') {
        const id = selectedMediaId(value ?? '')
        if (!id || !session.ids.includes(id)) throw new AppError(400, 'invalidInput')
        const media = await this.api.mediaDetail(id)
        if (media.type !== (session.command === 'anime' ? 'ANIME' : 'MANGA'))
          throw new AppError(404, 'notFound')
        result = { componentsV2: mediaDetailComponents(media, settings) }
      } else {
        if ((action === 'prev' && session.offset === 0) || (action === 'next' && !session.hasNextPage))
          throw new AppError(400, 'invalidInput')
        const offset = session.offset + (action === 'prev' ? -SEARCH_PAGE_SIZE : SEARCH_PAGE_SIZE)
        const page = await this.api.search(
          session.query,
          session.command === 'anime' ? 'ANIME' : 'MANGA',
          offset,
          SEARCH_PAGE_SIZE,
        )
        result = this.render(
          page.nodes,
          session.query,
          session.command,
          current,
          settings,
          offset,
          page.pageInfo.hasNextPage,
          session.until,
        )
      }
      this.searches.delete(token)
      return result
    } finally {
      session.busy = false
    }
  }
}
