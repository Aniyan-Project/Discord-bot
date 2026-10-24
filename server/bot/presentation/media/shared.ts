import { escapeMarkdown } from 'discord.js'
import { type MessageKey } from '../../../../shared/i18n.js'
export const statuses: Record<string, MessageKey> = {
  FINISHED: 'statusFinished',
  RELEASING: 'statusReleasing',
  NOT_YET_RELEASED: 'statusUpcoming',
  CANCELLED: 'statusCancelled',
  HIATUS: 'statusHiatus',
  UPCOMING: 'statusUpcoming',
}
export function text(value: string, max: number): string {
  return escapeMarkdown(
    value
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim(),
  ).slice(0, max)
}
