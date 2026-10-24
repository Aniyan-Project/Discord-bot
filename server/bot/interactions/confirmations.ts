import type { CommandId, Locale } from '../../../shared/domain.js'
import { t, type MessageKey } from '../../../shared/i18n.js'
import { AppError, randomToken } from '../../security.js'
import type { Store } from '../../store.js'
import type { CommandPolicy } from '../core/policy.js'
import type { CommandResult, Invocation } from '../core/types.js'
interface ConfirmationAction {
  prompt: MessageKey
  success: MessageKey
  execute: () => Promise<void>
}
interface Pending {
  userId: string
  guildId?: string
  context: Invocation
  task: ConfirmationAction
  command: CommandId
  until: number
  locale: Locale
}
export class ConfirmationSessions {
  private readonly pending = new Map<string, Pending>()
  constructor(
    private readonly store: Store,
    private readonly policy: CommandPolicy,
  ) {}
  create(ctx: Invocation, command: CommandId, action: ConfirmationAction): CommandResult {
    for (const [key, value] of this.pending) if (value.until <= Date.now()) this.pending.delete(key)
    if (this.pending.size > 5000) throw new AppError(429, 'rateLimited')
    const token = randomToken()
    this.pending.set(token, {
      userId: ctx.userId,
      guildId: ctx.guildId,
      context: { ...ctx },
      task: action,
      command,
      until: Date.now() + 5 * 60000,
      locale: this.policy.settings(ctx).locale,
    })
    const locale = this.policy.settings(ctx).locale
    return {
      private: true,
      content: t(locale, action.prompt),
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
    this.policy.enforce(action.context, action.command, false)
    await action.task.execute()
    if (action.guildId) this.store.event(action.guildId, action.command, true)
    return { content: t(action.locale, action.task.success), private: true }
  }
}
