import { discordId, ticketId } from '../../shared/tickets.js'
export function transcriptPath(guild: string, ticket: string) {
  return `/transcripts/${discordId.parse(guild)}/${ticketId.parse(ticket)}`
}
export function transcriptUrl(origin: string, guild: string, ticket: string) {
  return new URL(transcriptPath(guild, ticket), origin).href
}
export function transcriptReturnTo(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const match = /^\/transcripts\/(\d{17,20})\/([\da-f-]{36})$/i.exec(value)
  if (!match || !ticketId.safeParse(match[2]).success) return undefined
  return transcriptPath(match[1]!, match[2]!)
}
