import type { TicketQuestion } from './tickets.js'
export const fieldTypes = {
  short: 'Texto curto',
  long: 'Texto longo',
  select: 'Seleção única',
  multi: 'Seleção múltipla',
  radio: 'Botões de opção',
  checkboxes: 'Caixas de seleção',
  checkbox: 'Confirmação',
} as const
export function isChoice(q: TicketQuestion) {
  return ['select', 'multi', 'radio', 'checkboxes'].includes(q.style)
}
export function isMultiple(q: TicketQuestion) {
  return q.style === 'multi' || q.style === 'checkboxes'
}
export function selectedAnswers(value: string): string[] {
  try {
    const a: unknown = JSON.parse(value)
    return Array.isArray(a) && a.every((v) => typeof v === 'string') ? a : []
  } catch {
    return []
  }
}
export function validAnswer(q: TicketQuestion, value = ''): boolean {
  if (q.style === 'checkbox') return value === 'true' || (!q.required && (value === '' || value === 'false'))
  if (isMultiple(q)) {
    if (!value) return !q.required
    let values: unknown
    try {
      values = JSON.parse(value)
    } catch {
      return false
    }
    return (
      Array.isArray(values) &&
      values.every((v) => typeof v === 'string' && q.options.includes(v)) &&
      new Set(values).size === values.length &&
      values.length <= q.maxChoices &&
      values.length >= (q.required ? q.minChoices : 0)
    )
  }
  if (isChoice(q)) return (!value && !q.required) || q.options.includes(value)
  return (
    (!q.required || !!value.trim()) &&
    value.length <= q.maxLength &&
    (!value || value.length >= (q.minLength ?? 0))
  )
}
export function displayAnswer(q: TicketQuestion | undefined, value: string) {
  if (q && isMultiple(q)) return selectedAnswers(value).join(', ')
  if (q?.style === 'checkbox') return value === 'true' ? 'Sim' : 'Não'
  return value
}
