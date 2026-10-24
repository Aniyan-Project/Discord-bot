import { z } from 'zod'
export const ticketId = z.string().uuid()
export const discordId = z.string().regex(/^\d{17,20}$/)
const optionalId = z.union([discordId, z.literal('')]).default('')
const roleIds = z.array(discordId).max(20).default([])
export const questionSchema = z
  .object({
    id: ticketId,
    label: z.string().trim().min(1).max(45),
    style: z.enum(['short', 'long']).default('long'),
    required: z.boolean().default(true),
    maxLength: z.number().int().min(1).max(2000).default(1000),
  })
  .strict()
export const topicSchema = z
  .object({
    id: ticketId,
    name: z.string().trim().min(1).max(80),
    emoji: z.string().max(16).default(''),
    description: z.string().max(100).default(''),
    categoryId: optionalId,
    supportRoleIds: roleIds,
    welcome: z.string().max(1500).default(''),
    questions: z.array(questionSchema).max(5).default([]),
    priority: z.enum(['normal', 'high', 'low']).default('normal'),
    style: z.enum(['channel', 'thread']).default('channel'),
    threadParentId: optionalId,
    maxPerUser: z.number().int().min(1).max(10).default(1),
    pingSupport: z.boolean().default(false),
    staffThread: z.boolean().default(false),
  })
  .strict()
export const panelSchema = z
  .object({
    id: ticketId,
    name: z.string().trim().min(1).max(80),
    channelId: optionalId,
    format: z.enum(['classic', 'v2']).default('v2'),
    title: z.string().trim().min(1).max(256),
    description: z.string().max(2000).default(''),
    footer: z.string().max(200).default(''),
    color: z
      .string()
      .regex(/^#[\da-f]{6}$/i)
      .default('#ff9955'),
    image: z.union([z.string().url().startsWith('https://').max(500), z.literal('')]).default(''),
    style: z.enum(['select', 'buttons']).default('select'),
    topics: z.array(topicSchema).min(1).max(5),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (new Set(p.topics.map((t) => t.id)).size !== p.topics.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate topics' })
    for (const t of p.topics)
      if (new Set(t.questions.map((q) => q.id)).size !== t.questions.length)
        ctx.addIssue({ code: 'custom', message: 'Duplicate questions' })
  })
export const ticketSettingsSchema = z
  .object({
    categoryId: optionalId,
    threadParentId: optionalId,
    supportRoleIds: roleIds,
    managerRoleIds: roleIds,
    logChannelId: optionalId,
    locale: z.enum(['pt-BR', 'en', 'es']).default('pt-BR'),
    maxActive: z.number().int().min(1).max(500).default(50),
    maxPerUser: z.number().int().min(1).max(10).default(2),
    cooldownSeconds: z.number().int().min(0).max(86400).default(60),
    namePattern: z
      .string()
      .regex(/^[a-z0-9{}_-]{1,80}$/)
      .default('ticket-{{number}}'),
    continuousNumbering: z.boolean().default(true),
    globalNumbering: z.boolean().default(true),
    privateOnClaim: z.boolean().default(false),
    pingOnClaim: z.boolean().default(true),
    pingSupport: z.boolean().default(false),
    staffThread: z.boolean().default(false),
    closeAction: z.enum(['archive', 'delete']).default('archive'),
    inactivityHours: z.union([z.literal(0), z.literal(24), z.literal(48), z.literal(168)]).default(0),
    retentionDays: z.union([z.literal(0), z.literal(7), z.literal(30), z.literal(90)]).default(30),
    dmTranscript: z.boolean().default(false),
    requireCloseReason: z.boolean().default(true),
    allowReopen: z.boolean().default(true),
    authorTranscript: z.boolean().default(false),
    closedMessage: z.string().max(1500).default(''),
  })
  .strict()
export type TicketPanel = z.infer<typeof panelSchema>
export type TicketTopic = z.infer<typeof topicSchema>
export type TicketSettings = z.infer<typeof ticketSettingsSchema>
export const defaultTicketSettings = ticketSettingsSchema.parse({})
export type TicketStatus = 'creating' | 'open' | 'progress' | 'closing' | 'closed' | 'error'
export interface TicketRecord {
  id: string
  guildId: string
  number: number
  panelId: string
  topic: TicketTopic
  authorId: string
  authorName: string
  status: TicketStatus
  staffId: string | null
  channelId: string | null
  staffThreadId: string | null
  createdAt: number
  lastActivity: number
  closedAt: number | null
  reason: string
  revision: number
  settings: TicketSettings
  answers: Record<string, string>
  notes: Array<{ actor: string; at: number; text: string }>
}
export interface Transcript {
  messages: Array<{
    id: string
    author: string
    authorId: string
    at: number
    content: string
    attachments: string[]
  }>
  truncated: boolean
  contentAvailable: boolean
  capturedAt: number
}
export interface TicketResources {
  channels: Array<{ id: string; name: string }>
  categories: Array<{ id: string; name: string }>
  roles: Array<{ id: string; name: string }>
}
export interface PanelView {
  panel: TicketPanel
  revision: number
  messageId: string | null
  publishedChannelId: string | null
  publishedAt: number | null
  publishedPanel?: TicketPanel | null
}
export function ticketVariables(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{\{(user|server|ticketId|topic|staff|number)\}\}/g, (_, key: string) =>
    String(values[key] ?? ''),
  )
}
export function newTicketPanel(): TicketPanel {
  return panelSchema.parse({
    id: crypto.randomUUID(),
    name: 'Central de suporte',
    title: 'Como podemos ajudar?',
    description: 'Escolha um assunto para abrir um atendimento privado.',
    footer: 'Branilist • Suporte à comunidade',
    topics: [
      {
        id: crypto.randomUUID(),
        name: 'Minha conta',
        emoji: '👤',
        description: 'Acesso, perfil e biblioteca.',
        welcome: 'Olá, {{user}}! Nossa equipe vai ajudar você.',
        questions: [{ id: crypto.randomUUID(), label: 'Descreva o problema.' }],
      },
    ],
  })
}
