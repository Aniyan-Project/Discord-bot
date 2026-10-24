import { commandIds, type CommandId } from '../../../shared/domain.js'
import collections from './account/collections.js'
import connect from './account/connect.js'
import disconnect from './account/disconnect.js'
import favourites from './account/favourites.js'
import library from './account/library.js'
import profile from './account/profile.js'
import progress from './account/progress.js'
import remove from './account/remove.js'
import anime from './catalog/anime.js'
import manga from './catalog/manga.js'
import media from './catalog/media.js'
import trending from './catalog/trending.js'
import settings from './server/settings.js'
import type { CommandDefinition } from './types.js'
import help from './utility/help.js'
import ping from './utility/ping.js'
export const commandRegistry = {
  anime,
  manga,
  media,
  trending,
  profile,
  library,
  progress,
  remove,
  favourites,
  collections,
  connect,
  disconnect,
  settings,
  help,
  ping,
} satisfies { [Id in CommandId]: CommandDefinition<Id> }
export const commands: readonly CommandDefinition[] = commandIds.map((id) => commandRegistry[id])
const aliasEntries = commands.flatMap((command) =>
  command.aliases.map((alias) => [alias, command.id] as const),
)
const names = new Set<string>(commandIds)
for (const [alias] of aliasEntries) {
  if (names.has(alias)) throw Error('Duplicate command alias: ' + alias)
  names.add(alias)
}
export const commandAliases: Readonly<Record<string, CommandId>> = Object.freeze(
  Object.fromEntries(aliasEntries),
)
export function findCommand(name: string): CommandDefinition | undefined {
  return Object.hasOwn(commandRegistry, name) ? commandRegistry[name as CommandId] : undefined
}
