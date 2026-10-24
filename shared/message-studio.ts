import { z } from 'zod'
import type { Locale } from './domain.js'

const text = z.string().max(16000)
const color = z.number().int().min(0).max(0xffffff)
const media = z.object({ url: text }).strict()
export const studioEmbedSchema = z
  .object({
    title: text.optional(),
    description: text.optional(),
    url: text.optional(),
    timestamp: text.optional(),
    color: color.optional(),
    author: z.object({ name: text, url: text.optional(), icon_url: text.optional() }).strict().optional(),
    footer: z.object({ text, icon_url: text.optional() }).strict().optional(),
    image: media.optional(),
    thumbnail: media.optional(),
    fields: z
      .array(z.object({ name: text, value: text, inline: z.boolean().optional() }).strict())
      .max(25)
      .optional(),
  })
  .strict()
export interface StudioComponent {
  type: number
  id?: number
  components?: StudioComponent[]
  accessory?: StudioComponent
  content?: string
  accent_color?: number | null
  spoiler?: boolean
  media?: { url: string }
  description?: string
  items?: Array<{ media: { url: string }; description?: string; spoiler?: boolean }>
  divider?: boolean
  spacing?: number
  style?: number
  label?: string
  url?: string
  disabled?: boolean
  emoji?: { id?: string; name?: string; animated?: boolean }
}
const componentBase = { id: z.number().int().min(0).optional() }
export const studioComponentSchema: z.ZodType<StudioComponent> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z
      .object({
        ...componentBase,
        type: z.literal(17),
        accent_color: color.nullable().optional(),
        spoiler: z.boolean().optional(),
        components: z.array(studioComponentSchema).max(40),
      })
      .strict(),
    z.object({ ...componentBase, type: z.literal(10), content: text }).strict(),
    z
      .object({
        ...componentBase,
        type: z.literal(9),
        components: z.array(studioComponentSchema).max(3),
        accessory: studioComponentSchema,
      })
      .strict(),
    z
      .object({
        ...componentBase,
        type: z.literal(11),
        media,
        description: text.optional(),
        spoiler: z.boolean().optional(),
      })
      .strict(),
    z
      .object({
        ...componentBase,
        type: z.literal(12),
        items: z
          .array(z.object({ media, description: text.optional(), spoiler: z.boolean().optional() }).strict())
          .max(10),
      })
      .strict(),
    z
      .object({
        ...componentBase,
        type: z.literal(14),
        divider: z.boolean().optional(),
        spacing: z.union([z.literal(1), z.literal(2)]).optional(),
      })
      .strict(),
    z
      .object({ ...componentBase, type: z.literal(1), components: z.array(studioComponentSchema).max(5) })
      .strict(),
    z
      .object({
        ...componentBase,
        type: z.literal(2),
        style: z.literal(5),
        label: text.optional(),
        url: text,
        disabled: z.boolean().optional(),
        emoji: z
          .object({
            id: z
              .string()
              .regex(/^\d{17,20}$/)
              .optional(),
            name: text.optional(),
            animated: z.boolean().optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
  ]),
)
export const studioDraftSchema = z
  .object({
    version: z.literal(1),
    name: z.string().max(100),
    mode: z.enum(['classic', 'v2']),
    channelId: z.string().max(40),
    sender: z
      .object({ type: z.enum(['bot', 'webhook']), name: z.string().max(500), avatar: z.string().max(2048) })
      .strict(),
    mentions: z.array(z.enum(['users', 'roles', 'everyone'])).max(3),
    content: text,
    embeds: z.array(studioEmbedSchema).max(10),
    components: z.array(studioComponentSchema).max(40),
  })
  .strict()
export type StudioDraft = z.infer<typeof studioDraftSchema>
export type StudioVariables = Record<string, string>
export type StudioEmbed = z.infer<typeof studioEmbedSchema>
export interface StudioPayload {
  content?: string
  embeds?: StudioEmbed[]
  flags?: number
  components?: StudioComponent[]
  allowed_mentions: { parse: Array<'users' | 'roles' | 'everyone'>; replied_user: false }
  username?: string
  avatar_url?: string
}

// Guard depth/size before recursive schema parsing, including untrusted JSON imports.
export function parseStudioDraft(value: unknown): StudioDraft {
  let nodes = 0
  function visit(v: unknown, depth: number) {
    if (depth > 16 || ++nodes > 6000) throw Error('invalidInput')
    if (v && typeof v === 'object')
      for (const [key, child] of Object.entries(v)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('invalidInput')
        visit(child, depth + 1)
      }
  }
  visit(value, 0)
  if (JSON.stringify(value).length > 256000) throw Error('invalidInput')
  return studioDraftSchema.parse(value)
}
export function studioURL(value: string | undefined): boolean {
  try {
    const u = new URL(value ?? '')
    return u.protocol === 'https:' && !u.username && !u.password
  } catch {
    return false
  }
}
function cleanEmbed(embed: StudioEmbed): StudioEmbed {
  const result = structuredClone(embed)
  for (const key of ['title', 'description', 'url', 'timestamp'] as const)
    if (!result[key]) delete result[key]
  if (!result.author?.name) delete result.author
  if (!result.footer?.text) delete result.footer
  if (!result.image?.url) delete result.image
  if (!result.thumbnail?.url) delete result.thumbnail
  if (!result.fields?.length) delete result.fields
  for (const target of [result.author, result.footer])
    if (target) {
      if (!target.icon_url) delete target.icon_url
      if ('url' in target && !target.url) delete target.url
    }
  return result
}
export function resolveStudioVariables<T>(value: T, variables: StudioVariables): T {
  function walk(v: unknown): unknown {
    if (typeof v === 'string')
      return v.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_all, key: string) => {
        if (!Object.hasOwn(variables, key)) throw Error(`unknownVariable:${key}`)
        return variables[key]!
      })
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object')
      return Object.fromEntries(Object.entries(v).map(([k, child]) => [k, walk(child)]))
    return v
  }
  return walk(value) as T
}
export function studioPayload(
  draft: StudioDraft,
  variables: StudioVariables,
  resolved = true,
): StudioPayload {
  const payload: StudioPayload = {
    ...(draft.mode === 'classic'
      ? { ...(draft.content ? { content: draft.content } : {}), embeds: draft.embeds.map(cleanEmbed) }
      : { flags: 32768, components: structuredClone(draft.components) }),
    allowed_mentions: { parse: [...new Set(draft.mentions)], replied_user: false },
    ...(draft.sender.type === 'webhook'
      ? { username: draft.sender.name, ...(draft.sender.avatar ? { avatar_url: draft.sender.avatar } : {}) }
      : {}),
  }
  const result = resolved ? resolveStudioVariables(payload, variables) : payload
  if (resolved && !result.avatar_url) delete result.avatar_url
  if (resolved && result.embeds) result.embeds = result.embeds.map(cleanEmbed)
  return result
}
export function validateStudioPayload(payload: StudioPayload): string[] {
  const errors: string[] = []
  const check = (valid: unknown, path: string) => {
    if (!valid) errors.push(path)
  }
  const size = (s: string | undefined, max: number, path: string, required = false) =>
    check((!required || !!s?.trim()) && (s?.length ?? 0) <= max, path)
  const url = (s: string | undefined, path: string, required = false) =>
    check((!s && !required) || studioURL(s), path)
  if (payload.username !== undefined) size(payload.username, 80, 'webhook.name', true)
  url(payload.avatar_url, 'webhook.avatar')
  if (payload.flags === 32768) {
    check(!payload.content && !payload.embeds, 'components.format')
    check(payload.components?.length, 'components.empty')
    let count = 0,
      chars = 0
    const ids = new Set<number>()
    function visit(c: StudioComponent, parent: number) {
      count++
      if (c.id) {
        check(!ids.has(c.id), 'components.id')
        ids.add(c.id)
      }
      const allowed =
        parent === 9 ? [10] : parent === 1 ? [2] : parent === 17 ? [1, 9, 10, 12, 14] : [1, 9, 10, 12, 14, 17]
      check(allowed.includes(c.type), 'components.nesting')
      if (c.type === 10) {
        size(c.content, 4000, 'components.text', true)
        chars += c.content?.length ?? 0
      }
      if (c.type === 9) {
        check(c.components?.length && c.components.length <= 3, 'components.section')
        check(c.accessory && [2, 11].includes(c.accessory.type), 'components.accessory')
        if (c.accessory) {
          count++
          if (c.accessory.id) {
            check(!ids.has(c.accessory.id), 'components.id')
            ids.add(c.accessory.id)
          }
          validateAccessory(c.accessory)
        }
      }
      if (c.type === 17) check(c.components?.length, 'components.container')
      if (c.type === 1) check(c.components?.length && c.components.length <= 5, 'components.buttons')
      if (c.type === 2) validateAccessory(c)
      if (c.type === 12) {
        check(c.items?.length && c.items.length <= 10, 'components.gallery')
        for (const item of c.items ?? []) {
          url(item.media.url, 'components.image', true)
          size(item.description, 1024, 'components.imageDescription')
        }
      }
      c.components?.forEach((child) => visit(child, c.type))
    }
    function validateAccessory(c: StudioComponent) {
      if (c.type === 11) {
        url(c.media?.url, 'components.thumbnail', true)
        size(c.description, 1024, 'components.imageDescription')
      }
      if (c.type === 2) {
        check(c.style === 5, 'components.buttonStyle')
        url(c.url, 'components.link', true)
        size(c.label, 80, 'components.label', !c.emoji)
        size(c.emoji?.name, 100, 'components.emoji')
      }
    }
    payload.components?.forEach((c) => visit(c, 0))
    check(count <= 40, 'components.limit40')
    check(chars <= 4000, 'components.limit4000')
  } else {
    size(payload.content, 2000, 'content.limit2000')
    check(payload.content?.trim() || payload.embeds?.length, 'message.empty')
    check((payload.embeds?.length ?? 0) <= 10, 'embeds.limit10')
    let chars = 0
    for (const [index, e] of (payload.embeds ?? []).entries()) {
      const p = `embed${index + 1}`
      check(
        e.title ||
          e.description ||
          e.author?.name ||
          e.footer?.text ||
          e.image?.url ||
          e.thumbnail?.url ||
          e.fields?.length,
        `${p}.empty`,
      )
      size(e.title, 256, `${p}.title`)
      size(e.description, 4096, `${p}.description`)
      size(e.author?.name, 256, `${p}.author`)
      size(e.footer?.text, 2048, `${p}.footer`)
      for (const value of [
        e.url,
        e.image?.url,
        e.thumbnail?.url,
        e.author?.url,
        e.author?.icon_url,
        e.footer?.icon_url,
      ])
        url(value, `${p}.url`)
      if (e.timestamp) check(!Number.isNaN(Date.parse(e.timestamp)), `${p}.timestamp`)
      check((e.fields?.length ?? 0) <= 25, `${p}.fields`)
      chars +=
        (e.title?.length ?? 0) +
        (e.description?.length ?? 0) +
        (e.author?.name?.length ?? 0) +
        (e.footer?.text?.length ?? 0)
      for (const f of e.fields ?? []) {
        size(f.name, 256, `${p}.fieldName`, true)
        size(f.value, 1024, `${p}.fieldValue`, true)
        chars += f.name.length + f.value.length
      }
    }
    check(chars <= 6000, 'embeds.limit6000')
  }
  return [...new Set(errors)]
}
export function studioTime(locale: Locale, now = new Date()) {
  return {
    date: now.toLocaleDateString(locale, { timeZone: 'America/Sao_Paulo' }),
    time: now.toLocaleTimeString(locale, {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }),
    timestamp: now.toISOString(),
  }
}
