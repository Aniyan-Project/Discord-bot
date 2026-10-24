import { commandIds, type CommandId } from '../../../shared/domain.js'
import { commandAliases as aliases } from '../commands/registry.js'
export { commandAliases as aliases } from '../commands/registry.js'
export function tokenize(input: string): string[] {
  if (input.length > 2000) throw Error('invalidInput')
  const words: string[] = []
  let word = '',
    quote = '',
    escaped = false
  for (const c of input.trim()) {
    if (escaped) {
      word += c
      escaped = false
    } else if (c === '\\') escaped = true
    else if (quote) {
      if (c === quote) quote = ''
      else word += c
    } else if (c === '"' || c === "'") quote = c
    else if (/\s/.test(c)) {
      if (word) {
        words.push(word)
        word = ''
      }
    } else word += c
  }
  if (quote || escaped) throw Error('invalidInput')
  if (word) words.push(word)
  return words
}
export function parsePrefix(content: string, prefix: string): { command: CommandId; args: string[] } | null {
  if (!content.startsWith(prefix)) return null
  const words = tokenize(content.slice(prefix.length))
  const name = words.shift()?.toLowerCase()
  if (!name) return null
  const command = commandIds.includes(name as CommandId)
    ? (name as CommandId)
    : Object.hasOwn(aliases, name)
      ? aliases[name]
      : undefined
  return command ? { command, args: words } : null
}
