import type { Interaction } from 'discord.js'
import type { BotContext } from '../core/context.js'
import { createAutocompleteHandler } from './autocomplete.js'
import { createConfirmationHandler } from './confirmation.js'
import { createMediaSearchHandler } from './media-search.js'
import { createSlashHandler } from './slash.js'
import type { InteractionHandler } from './types.js'
import { ticketInteractionHandler } from '../tickets/interactions.js'
export function createInteractionRouter(context: BotContext) {
  const handlers: readonly InteractionHandler[] = [
    ...(context.tickets ? [ticketInteractionHandler(context.tickets)] : []),
    createSlashHandler(context),
    createAutocompleteHandler(context),
    createMediaSearchHandler(context),
    createConfirmationHandler(context),
  ]
  return async (interaction: Interaction) => {
    const handler = handlers.find((h) => h.matches(interaction))
    if (handler) await handler.handle(interaction)
  }
}
