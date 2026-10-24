import { defaultSettings, type CommandId, type GuildSettings } from '../../../shared/domain.js'
import { AppError } from '../../security.js'
import type { Store } from '../../store.js'
import { Cooldowns } from './cooldowns.js'
import type { Invocation } from './types.js'
export class CommandPolicy {
  private readonly cooldowns = new Cooldowns()
  constructor(private readonly store: Store) {}
  settings(ctx: Invocation): GuildSettings {
    return ctx.guildId
      ? this.store.settings(ctx.guildId).settings
      : { ...defaultSettings, locale: ctx.locale }
  }
  enforce(ctx: Invocation, command: CommandId, cooldown = true): GuildSettings {
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
}
