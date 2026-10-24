import type { Interaction } from 'discord.js'
export interface InteractionHandler {
  readonly name: string
  matches: (interaction: Interaction) => boolean
  handle: (interaction: Interaction) => Promise<void>
}
