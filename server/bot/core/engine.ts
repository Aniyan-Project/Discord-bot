import { z } from 'zod'
import type { CommandId } from '../../../shared/domain.js'
import type { BranilistService } from '../../branilist.js'
import type { Config } from '../../config.js'
import { AppError } from '../../security.js'
import type { Store } from '../../store.js'
import { commandRegistry } from '../commands/registry.js'
import { ConfirmationSessions } from '../interactions/confirmations.js'
import { MediaSearchSessions } from '../interactions/media-search.js'
import { CommandPolicy } from './policy.js'
import type { CommandResult, Invocation } from './types.js'
export type { CommandResult, Invocation } from './types.js'
export class CommandEngine {
  private readonly policy: CommandPolicy
  private readonly confirmations: ConfirmationSessions
  private readonly searches: MediaSearchSessions
  constructor(
    private readonly config: Config,
    private readonly store: Store,
    private readonly api: BranilistService,
  ) {
    this.policy = new CommandPolicy(store)
    this.confirmations = new ConfirmationSessions(store, this.policy)
    this.searches = new MediaSearchSessions(api, this.policy)
  }
  settings(ctx: Invocation) {
    return this.policy.settings(ctx)
  }
  searchContext(token: string, userId: string) {
    return this.searches.searchContext(token, userId)
  }
  interactSearch(...args: Parameters<MediaSearchSessions['interactSearch']>) {
    return this.searches.interactSearch(...args)
  }
  pendingGuild(token: string) {
    return this.confirmations.pendingGuild(token)
  }
  actionContext(token: string, userId: string) {
    return this.confirmations.actionContext(token, userId)
  }
  confirm(...args: Parameters<ConfirmationSessions['confirm']>) {
    return this.confirmations.confirm(...args)
  }
  async execute(command: CommandId, args: string[], ctx: Invocation): Promise<CommandResult> {
    const settings = this.policy.enforce(ctx, command)
    try {
      const result = await commandRegistry[command].execute(args, {
        invocation: ctx,
        settings,
        config: this.config,
        store: this.store,
        api: this.api,
        confirmations: this.confirmations,
        searches: this.searches,
      })
      if (ctx.guildId && !result.confirm) this.store.event(ctx.guildId, command, true)
      return result
    } catch (error) {
      if (ctx.guildId) this.store.event(ctx.guildId, command, false)
      if (error instanceof z.ZodError) throw new AppError(400, 'invalidInput')
      throw error
    }
  }
}
