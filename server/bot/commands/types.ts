import type { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import type { CommandId, GuildSettings } from '../../../shared/domain.js'
import { commandDescriptions, type MessageKey } from '../../../shared/i18n.js'
import type { BranilistService } from '../../branilist.js'
import type { CommandContext, CommandResult } from '../core/types.js'
export interface AutocompleteContext {
  api: BranilistService
  settings?: GuildSettings
}
export interface CommandDefinition<Id extends CommandId = CommandId> {
  id: Id
  description: MessageKey
  aliases: readonly string[]
  localizedNames?: readonly [string, string]
  privateReply: boolean | ((interaction: ChatInputCommandInteraction) => boolean)
  slashArgs?: (interaction: ChatInputCommandInteraction) => string[]
  configureSlash?: (builder: SlashCommandBuilder) => void
  optionDescriptions?: Record<string, readonly [string, string, string]>
  autocomplete?: (
    query: string,
    context: AutocompleteContext,
  ) => Promise<Array<{ name: string; value: string }>>
  execute: (args: string[], context: CommandContext) => Promise<CommandResult>
}
export function defineCommand<Id extends CommandId>(
  id: Id,
  definition: Omit<CommandDefinition<Id>, 'id' | 'description'>,
): CommandDefinition<Id> {
  return { id, description: commandDescriptions[id], ...definition }
}
