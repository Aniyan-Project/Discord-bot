import { commandIds, type CommandId } from '../shared/domain.js'
export const aliases: Record<string, CommandId> = {
  perfil: 'profile',
  biblioteca: 'library',
  lista: 'library',
  progresso: 'progress',
  progreso: 'progress',
  remover: 'remove',
  eliminar: 'remove',
  favoritos: 'favourites',
  favorites: 'favourites',
  colecoes: 'collections',
  colecciones: 'collections',
  conectar: 'connect',
  vincular: 'connect',
  desconectar: 'disconnect',
  desvincular: 'disconnect',
  config: 'settings',
  ajuda: 'help',
  ayuda: 'help',
  tendencias: 'trending',
  alta: 'trending',
}
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
  const command = commandIds.includes(name as CommandId) ? (name as CommandId) : aliases[name]
  return command ? { command, args: words } : null
}
export class Cooldowns {
  private readonly entries = new Map<string, number>()
  check(key: string, seconds: number, now = Date.now()): number {
    const until = this.entries.get(key) ?? 0
    if (until > now) return Math.ceil((until - now) / 1000)
    if (this.entries.size > 10000) for (const [k, v] of this.entries) if (v <= now) this.entries.delete(k)
    this.entries.set(key, now + seconds * 1000)
    return 0
  }
}
