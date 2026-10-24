import type { AutocompleteInteraction } from 'discord.js'
import type { CommandId } from '../../../shared/domain.js'
import { findCommand } from '../commands/registry.js'
import type { BotContext } from '../core/context.js'
import type { InteractionHandler } from './types.js'
export function createAutocompleteHandler(runtime: BotContext): InteractionHandler {
  const lastAutocomplete = new Map<string, number>()
  async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const definition = findCommand(interaction.commandName)
    if (!definition?.autocomplete) return
    const now = Date.now()
    const previous = lastAutocomplete.get(interaction.user.id) ?? 0
    if (now - previous < 1200) {
      await interaction.respond([]).catch(() => undefined)
      return
    }
    if (lastAutocomplete.size > 10000) lastAutocomplete.clear()
    lastAutocomplete.set(interaction.user.id, now)
    try {
      const query = interaction.options.getFocused()
      if (query.length < 2 || query.length > 150) {
        await interaction.respond([])
        return
      }
      const settings = interaction.guildId ? runtime.store.settings(interaction.guildId).settings : undefined
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
          definition.autocomplete(query, { api: runtime.api, settings }),
          timeout,
        ])
        await interaction.respond(result ?? [])
      } finally {
        clearTimeout(timer)
      }
    } catch {
      await interaction.respond([]).catch(() => undefined)
    }
  }
  return {
    name: 'autocomplete',
    matches: (i) => i.isAutocomplete(),
    async handle(i) {
      if (i.isAutocomplete()) await autocomplete(i)
    },
  }
}
