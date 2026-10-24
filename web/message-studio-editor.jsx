import React, { useState, useRef, useEffect, createContext, useContext } from 'react'
import { useBlocker } from 'react-router-dom'
import { parseStudioDraft, studioPayload, validateStudioPayload } from '../shared/message-studio.js'
import './message-studio.css'
import {
  LayoutDashboard,
  Settings2,
  Search,
  Radio,
  UserRound,
  Terminal,
  MessageSquareText,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  Braces,
  Code2,
  Eye,
  Monitor,
  Smartphone,
  Send,
  Save,
  Check,
  AlertCircle,
  X,
  Menu,
  Type,
  Image as ImageIcon,
  Minus,
  Link as LinkIcon,
  GripVertical,
  Palette,
  Webhook,
  Bot,
  FileJson,
  RotateCcw,
  SlidersHorizontal,
  ExternalLink,
  Globe,
  Clock,
  Hash,
  ShieldCheck,
} from 'lucide-react'

import { studioText } from './message-studio-i18n.js'
const COVER = 'https://cdn.myanimelist.net/images/anime/1015/138006l.webp'
const BANNER =
  'https://media.branilist.com/media-banner/2026/10/8f1482ca3c7032f04bd590c61fc2a66a/original.jpg'
const variableNames = {
  server: ['Nome do servidor', 'Server name', 'Nombre del servidor'],
  serverId: ['ID do servidor', 'Server ID', 'ID del servidor'],
  serverIcon: ['URL do ícone do servidor', 'Server icon URL', 'URL del icono del servidor'],
  memberCount: ['Quantidade de membros', 'Member count', 'Cantidad de miembros'],
  channel: ['Nome do canal', 'Channel name', 'Nombre del canal'],
  channelId: ['ID do canal', 'Channel ID', 'ID del canal'],
  user: ['Nome de quem envia', 'Sender display name', 'Nombre de quien envía'],
  userId: ['ID de quem envia', 'Sender user ID', 'ID de quien envía'],
  userMention: ['Menção de quem envia', 'Sender mention', 'Mención de quien envía'],
  userAvatar: ['URL do avatar de quem envia', 'Sender avatar URL', 'URL del avatar de quien envía'],
  date: ['Data atual', 'Current date', 'Fecha actual'],
  time: ['Horário atual', 'Current time', 'Hora actual'],
  timestamp: ['Data e hora em ISO 8601', 'Date and time in ISO 8601', 'Fecha y hora en ISO 8601'],
}
const blankEmbed = () => ({
  color: 0xff9955,
  title: '',
  description: '',
  url: '',
  author: { name: '', url: '', icon_url: '' },
  thumbnail: { url: '' },
  image: { url: '' },
  fields: [],
  footer: { text: '', icon_url: '' },
})
export const studioInitialDraft = {
  version: 1,
  name: 'Boas-vindas ao clube',
  mode: 'classic',
  channelId: '',
  sender: { type: 'bot', name: '{{server}}', avatar: '{{serverIcon}}' },
  mentions: [],
  content: 'Uma nova história começa por aqui, {{user}}.',
  embeds: [
    {
      ...blankEmbed(),
      title: 'Bem-vindo ao {{server}}!',
      description:
        'Explore novas histórias, compartilhe suas descobertas e faça parte do nosso clube.\n\n**Seu próximo episódio começa aqui.**',
      url: 'https://branilist.com',
      author: {
        name: '{{server}}',
        icon_url: '{{serverIcon}}',
        url: 'https://branilist.com',
      },
      thumbnail: { url: '' },
      image: { url: BANNER },
      fields: [
        {
          name: 'Nossa comunidade',
          value: '{{memberCount}} membros',
          inline: true,
        },
        { name: 'Seu espaço', value: '#anime-e-mangá', inline: true },
      ],
      footer: { text: '{{server}} · Uma história de cada vez.', icon_url: '' },
    },
  ],
  components: [
    {
      type: 17,
      accent_color: 0xff9955,
      components: [
        {
          type: 9,
          components: [
            {
              type: 10,
              content: '## Bem-vindo ao {{server}}!\nExplore novas histórias e faça parte do nosso clube.',
            },
          ],
          accessory: {
            type: 11,
            media: { url: '{{serverIcon}}' },
            description: 'Ícone do servidor',
          },
        },
        {
          type: 10,
          content: '**Nossa comunidade**\n{{memberCount}} pessoas para compartilhar o próximo episódio.',
        },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: 'Explorar o Branilist',
              url: 'https://branilist.com',
            },
          ],
        },
      ],
    },
  ],
}
const AppContext = createContext(null)
function useStudio() {
  return useContext(AppContext)
}
const clone = (value) => structuredClone(value)
function at(object, path) {
  return path.reduce((value, key) => value?.[key], object)
}
function change(object, path, value) {
  const next = clone(object)
  let target = next
  for (const key of path.slice(0, -1)) {
    target[key] ??= {}
    target = target[key]
  }
  target[path.at(-1)] = value
  return next
}
function safeURL(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined
  } catch {
    return undefined
  }
}
function resolve(value, context, depth = 0) {
  if (depth > 20) throw Error('invalidInput')
  if (typeof value === 'string')
    return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (all, key) => context[key] ?? all)
  if (Array.isArray(value)) return value.map((v) => resolve(v, context, depth + 1))
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, context, depth + 1)]))
  return value
}
function makePayload(draft, context, resolved = true) {
  return studioPayload(draft, context, resolved)
}
function assertSafeStructure(value, depth = 0) {
  if (depth > 16) throw Error('invalidInput')
  if (value && typeof value === 'object')
    for (const v of Object.values(value)) assertSafeStructure(v, depth + 1)
}
function checkBlock(c) {
  if (!c || typeof c !== 'object' || !Number.isInteger(c.type)) throw Error('invalidInput')
  if (c.components !== undefined && !Array.isArray(c.components)) throw Error('invalidInput')
  c.components?.forEach(checkBlock)
  if (c.accessory) checkBlock(c.accessory)
  if (c.content !== undefined && typeof c.content !== 'string') throw Error('invalidInput')
  if (
    c.items !== undefined &&
    (!Array.isArray(c.items) || c.items.some((item) => !item?.media || typeof item.media.url !== 'string'))
  )
    throw Error('invalidInput')
}
function checkDraft(d) {
  try {
    return parseStudioDraft(d)
  } catch {
    throw Error('invalidInput')
  }
}
function fromJSON(text, previous) {
  if (text.length > 256000) throw Error('JSON > 256 KB')
  const raw = JSON.parse(text)
  assertSafeStructure(raw)
  if (!raw || typeof raw !== 'object') throw Error('invalidInput')
  if (
    raw.version === 1 &&
    ['classic', 'v2'].includes(raw.mode) &&
    Array.isArray(raw.embeds) &&
    Array.isArray(raw.components)
  ) {
    if (!raw.sender || !Array.isArray(raw.mentions)) throw Error('invalidInput')
    return checkDraft({ ...clone(studioInitialDraft), ...raw })
  }
  if (raw.messages && (!Array.isArray(raw.messages) || raw.messages.length !== 1)) throw Error('invalidInput')
  const p = raw.messages?.[0]?.data ?? raw.data ?? raw
  const next = clone(previous)
  if (Array.isArray(p.components) && ((p.flags ?? 0) & 32768 || !p.embeds)) {
    next.mode = 'v2'
    next.components = p.components
  } else if (Array.isArray(p.embeds)) {
    next.mode = 'classic'
    next.embeds = p.embeds.map((e) => ({ ...blankEmbed(), ...e }))
    next.content = p.content ?? ''
  } else if (p.title !== undefined || p.description !== undefined || p.fields !== undefined) {
    next.mode = 'classic'
    next.embeds = [{ ...blankEmbed(), ...p }]
    next.content = ''
  } else if (typeof p.content === 'string') {
    next.mode = 'classic'
    next.embeds = []
    next.content = p.content
  } else throw Error('invalidInput')
  if (p.username || p.avatar_url)
    next.sender = {
      type: 'webhook',
      name: p.username ?? next.sender.name,
      avatar: p.avatar_url ?? '',
    }
  if (p.allowed_mentions?.parse)
    next.mentions = p.allowed_mentions.parse.filter((x) => ['users', 'roles', 'everyone'].includes(x))
  return checkDraft(next)
}
function inspect(draft, context, t) {
  const errors = []
  let chars = 0,
    components = 0
  let p
  try {
    p = makePayload(draft, context)
  } catch {
    return { errors: [t('jsonError')], chars: 0, components: 0 }
  }
  const unknown = [...JSON.stringify(p).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1])
  for (const key of new Set(unknown)) errors.push(`${t('unknown')}: {{${key}}}`)
  const length = (s, n, label) => {
    if (s && String(s).length > n) errors.push(`${label}: ${t('limit')} (${n})`)
  }
  const image = (url, label) => {
    if (url && !safeURL(url)) errors.push(`${label}: ${t('https')}`)
  }
  if (draft.sender.type === 'webhook') {
    if (!p.username?.trim()) errors.push(t('webhookName') + ': ' + t('required'))
    length(p.username, 80, t('webhookName'))
    image(p.avatar_url, t('webhookAvatar'))
  }
  if (draft.mode === 'classic') {
    length(p.content, 2000, t('content'))
    if (p.embeds.length > 10) errors.push('Embed: ' + t('limit') + ' (10)')
    p.embeds.forEach((e, i) => {
      const prefix = `Embed ${i + 1}`
      length(e.title, 256, prefix + ' · ' + t('title'))
      length(e.description, 4096, prefix + ' · ' + t('description'))
      if (e.color !== undefined && (!Number.isInteger(e.color) || e.color < 0 || e.color > 0xffffff))
        errors.push(prefix + ' · ' + t('color'))
      image(e.url, prefix + ' · URL')
      image(e.image?.url, t('largeImage'))
      image(e.thumbnail?.url, t('thumbnail'))
      image(e.author?.icon_url, t('authorIcon'))
      image(e.author?.url, t('authorUrl'))
      image(e.footer?.icon_url, t('footerIcon'))
      length(e.author?.name, 256, t('authorName'))
      length(e.footer?.text, 2048, t('footerText'))
      if (e.timestamp && isNaN(Date.parse(e.timestamp))) errors.push(t('timestamp'))
      if ((e.fields?.length ?? 0) > 25) errors.push(t('fields') + ': ' + t('limit') + ' (25)')
      for (const f of e.fields ?? []) {
        if (!f.name || !f.value) errors.push(t('fields') + ': ' + t('required'))
        length(f.name, 256, t('fieldName'))
        length(f.value, 1024, t('fieldValue'))
      }
      chars +=
        String(e.title ?? '').length +
        String(e.description ?? '').length +
        String(e.author?.name ?? '').length +
        String(e.footer?.text ?? '').length +
        (e.fields ?? []).reduce((n, f) => n + String(f.name ?? '').length + String(f.value ?? '').length, 0)
      if (
        !e.title &&
        !e.description &&
        !e.author &&
        !e.footer &&
        !e.image &&
        !e.thumbnail &&
        !e.fields?.length
      )
        errors.push(prefix + ': ' + t('required'))
    })
    if (chars > 6000) errors.push(t('limit') + ' (6000)')
    if (!p.content && !p.embeds.length) errors.push(t('required'))
  } else {
    function visit(c) {
      components++
      if (c.type === 10) {
        chars += String(c.content ?? '').length
        if (!c.content) errors.push(t('text') + ': ' + t('required'))
      }
      if (c.type === 11) image(c.media?.url, t('image'))
      if (c.type === 12) {
        if (!c.items?.length || c.items.length > 10) errors.push(t('gallery') + ': 1–10')
        c.items?.forEach((item) => image(item.media?.url, t('image')))
      }
      if (c.type === 9 && !c.accessory) errors.push(t('accessory') + ': ' + t('required'))
      if (c.type === 2 && c.style === 5) {
        image(c.url, t('link'))
        length(c.label, 80, t('label'))
        if (!c.label) errors.push(t('label') + ': ' + t('required'))
      }
      c.components?.forEach(visit)
      if (c.accessory) visit(c.accessory)
    }
    p.components.forEach(visit)
    if (!components) errors.push(t('required'))
    if (components > 40) errors.push(t('limit') + ' (40)')
    if (chars > 4000) errors.push(t('limit') + ' (4000)')
  }
  try {
    const extra = validateStudioPayload(p)
    if (extra.length) errors.push(t('invalid') + ': ' + extra.join(', '))
  } catch {
    errors.push(t('jsonError'))
  }
  return { errors: [...new Set(errors)], chars, components }
}

function Field({
  label,
  path,
  multiline = false,
  hint,
  max,
  type = 'text',
  value,
  onChange,
  rows = 3,
  placeholder = '',
}) {
  const t = useStudio().tr
  const { draft, update, lastField } = useStudio()
  const val = value ?? at(draft, path) ?? ''
  const props = {
    value: val,
    type,
    placeholder,
    rows,
    maxLength: max,
    'aria-label': label,
    'data-path': path ? JSON.stringify(path) : undefined,
    onFocus: (e) => {
      if (path && ['text', 'url'].includes(type)) lastField.current = e.currentTarget
    },
    onChange: (e) =>
      onChange
        ? onChange(e.target.value)
        : update(path, type === 'number' ? Number(e.target.value) : e.target.value),
  }
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {max && (
          <small>
            {String(val).length}/{max}
          </small>
        )}
      </span>
      {multiline ? <textarea {...props} /> : <input {...props} />}{' '}
      {hint && <small className="help">{hint}</small>}
    </label>
  )
}
function CheckField({ label, checked, onChange }) {
  const t = useStudio().tr
  return (
    <label className="check-field">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
function IconButton({ icon: Icon, label, onClick, disabled }) {
  const t = useStudio().tr
  return (
    <button
      type="button"
      className="icon-btn"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={16} />
    </button>
  )
}
function Section({ title, children, open = false, summary }) {
  const t = useStudio().tr
  return (
    <details className="form-section" open={open}>
      <summary>
        {title}
        <span>
          {summary}
          <ChevronDown size={16} />
        </span>
      </summary>
      <div className="section-content">{children}</div>
    </details>
  )
}
function ArrayTools({ path, index, items, addLabel }) {
  const t = useStudio().tr
  const { update } = useStudio()
  const set = (next) => update(path, next)
  return (
    <div className="array-tools">
      <IconButton
        icon={ArrowUp}
        label={t('up')}
        disabled={index === 0}
        onClick={() => {
          const next = clone(items)
          ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
          set(next)
        }}
      />
      <IconButton
        icon={ArrowDown}
        label={t('down')}
        disabled={index === items.length - 1}
        onClick={() => {
          const next = clone(items)
          ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
          set(next)
        }}
      />
      <IconButton
        icon={Copy}
        label={t('duplicate')}
        onClick={() => set([...items.slice(0, index + 1), clone(items[index]), ...items.slice(index + 1)])}
      />
      <IconButton
        icon={Trash2}
        label={t('remove')}
        onClick={() => set(items.filter((_, i) => i !== index))}
      />
    </div>
  )
}
function ClassicEditor() {
  const t = useStudio().tr
  const { draft, update, embedIndex, setEmbedIndex } = useStudio()
  const index = Math.min(embedIndex, Math.max(0, draft.embeds.length - 1)),
    e = draft.embeds[index],
    p = ['embeds', index]
  return (
    <>
      <Field label={t('content')} path={['content']} multiline rows={2} hint={t('contentHint')} max={2000} />
      <div className="embed-switch">
        <div>
          {draft.embeds.map((_, i) => (
            <button
              type="button"
              key={i}
              className={index === i ? 'selected' : ''}
              onClick={() => setEmbedIndex(i)}
            >
              Embed {i + 1}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="text-btn"
          disabled={draft.embeds.length >= 10}
          onClick={() => {
            update(['embeds'], [...draft.embeds, blankEmbed()])
            setEmbedIndex(draft.embeds.length)
          }}
        >
          <Plus size={15} />
          {t('addEmbed')}
        </button>
      </div>
      {!e ? (
        <div className="empty-state">{t('emptyEmbed')}</div>
      ) : (
        <div className="editor-card">
          <div className="card-heading">
            <span>
              <MessageSquareText size={17} />
              Embed {index + 1}
            </span>
            <ArrayTools path={['embeds']} index={index} items={draft.embeds} />
          </div>
          <Section title={t('text')} open>
            <div className="color-title-row">
              <Field label={t('title')} path={[...p, 'title']} max={256} />
              <label className="color-field">
                <span>{t('color')}</span>
                <div>
                  <input
                    type="color"
                    value={
                      '#' +
                      Number(e.color ?? 0xff9955)
                        .toString(16)
                        .padStart(6, '0')
                    }
                    onChange={(ev) => update([...p, 'color'], parseInt(ev.target.value.slice(1), 16))}
                  />
                  <code>
                    {'#' +
                      Number(e.color ?? 0xff9955)
                        .toString(16)
                        .padStart(6, '0')
                        .toUpperCase()}
                  </code>
                </div>
              </label>
            </div>
            <Field label={t('description')} path={[...p, 'description']} multiline rows={4} max={4096} />
            <Field label={t('url')} path={[...p, 'url']} type="url" placeholder="https://branilist.com" />
          </Section>
          <Section title={t('fields')} open summary={`${e.fields?.length ?? 0}/25`}>
            <div className="fields-list">
              {(e.fields ?? []).map((f, i) => (
                <div className="custom-field" key={i}>
                  <div className="custom-field-top">
                    <strong>
                      {t('fieldName')} {i + 1}
                    </strong>
                    <ArrayTools path={[...p, 'fields']} index={i} items={e.fields} />
                  </div>
                  <div className="two-col">
                    <Field label={t('fieldName')} path={[...p, 'fields', i, 'name']} max={256} />
                    <Field label={t('fieldValue')} path={[...p, 'fields', i, 'value']} max={1024} />
                  </div>
                  <CheckField
                    label={t('inline')}
                    checked={f.inline}
                    onChange={(v) => update([...p, 'fields', i, 'inline'], v)}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="text-btn"
              disabled={(e.fields?.length ?? 0) >= 25}
              onClick={() =>
                update([...p, 'fields'], [...(e.fields ?? []), { name: '', value: '', inline: true }])
              }
            >
              <Plus size={15} />
              {t('addField')}
            </button>
          </Section>
          <Section title={t('author')}>
            <Field label={t('authorName')} path={[...p, 'author', 'name']} max={256} />
            <Field label={t('authorUrl')} path={[...p, 'author', 'url']} type="url" />
            <Field
              label={t('authorIcon')}
              path={[...p, 'author', 'icon_url']}
              type="url"
              placeholder="{{serverIcon}}"
            />
          </Section>
          <Section title={t('images')}>
            <Field label={t('thumbnail')} path={[...p, 'thumbnail', 'url']} type="url" />
            <Field label={t('largeImage')} path={[...p, 'image', 'url']} type="url" />
          </Section>
          <Section title={t('footer')}>
            <Field label={t('footerText')} path={[...p, 'footer', 'text']} max={2048} />
            <Field label={t('footerIcon')} path={[...p, 'footer', 'icon_url']} type="url" />
            <CheckField
              label={t('timestamp')}
              checked={!!e.timestamp}
              onChange={(v) => update([...p, 'timestamp'], v ? '{{timestamp}}' : undefined)}
            />
          </Section>
        </div>
      )}
    </>
  )
}
const newBlock = (type) =>
  type === 10
    ? { type: 10, content: '**Novo texto**\nEscreva sua mensagem aqui.' }
    : type === 9
      ? {
          type: 9,
          components: [
            {
              type: 10,
              content: '## Uma nova história\nPersonalize esta seção.',
            },
          ],
          accessory: {
            type: 11,
            media: { url: '{{serverIcon}}' },
            description: 'Ícone do servidor',
          },
        }
      : type === 12
        ? {
            type: 12,
            items: [{ media: { url: BANNER }, description: 'Imagem da comunidade' }],
          }
        : type === 14
          ? { type: 14, divider: true, spacing: 1 }
          : {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5,
                  label: 'Ver no Branilist',
                  url: 'https://branilist.com',
                },
              ],
            }
function BlockFields({ block, path }) {
  const t = useStudio().tr
  const { update, notify } = useStudio()
  if (block.type === 10) return <Field label={t('text')} path={[...path, 'content']} multiline rows={3} />
  if (block.type === 14)
    return (
      <>
        <CheckField
          label={t('divider')}
          checked={block.divider}
          onChange={(v) => update([...path, 'divider'], v)}
        />
        <label className="field">
          <span>{t('spacing')}</span>
          <select
            value={block.spacing ?? 1}
            onChange={(e) => update([...path, 'spacing'], Number(e.target.value))}
          >
            <option value="1">{t('small')}</option>
            <option value="2">{t('large')}</option>
          </select>
        </label>
      </>
    )
  if (block.type === 9)
    return (
      <>
        <Field label={t('text')} path={[...path, 'components', 0, 'content']} multiline rows={3} />
        <label className="field">
          <span>{t('accessory')}</span>
          <select
            value={block.accessory?.type === 2 ? 'button' : 'image'}
            onChange={(e) =>
              update(
                [...path, 'accessory'],
                e.target.value === 'image'
                  ? { type: 11, media: { url: '{{serverIcon}}' } }
                  : {
                      type: 2,
                      style: 5,
                      label: 'Ver no Branilist',
                      url: 'https://branilist.com',
                    },
              )
            }
          >
            <option value="image">{t('image')}</option>
            <option value="button">{t('button')}</option>
          </select>
        </label>
        {block.accessory?.type === 2 ? (
          <div className="two-col">
            <Field label={t('label')} path={[...path, 'accessory', 'label']} max={80} />
            <Field label={t('link')} path={[...path, 'accessory', 'url']} type="url" />
          </div>
        ) : (
          <>
            <Field label={t('imageUrl')} path={[...path, 'accessory', 'media', 'url']} type="url" />
            <Field label={t('alt')} path={[...path, 'accessory', 'description']} />
            <CheckField
              label={t('spoiler')}
              checked={block.accessory?.spoiler}
              onChange={(v) => update([...path, 'accessory', 'spoiler'], v)}
            />
          </>
        )}
      </>
    )
  if (block.type === 12)
    return (
      <>
        {(block.items ?? []).map((item, i) => (
          <div className="sub-item" key={i}>
            <div className="row-title">
              <strong>
                {t('image')} {i + 1}
              </strong>
              <IconButton
                icon={Trash2}
                label={t('remove')}
                onClick={() =>
                  update(
                    [...path, 'items'],
                    block.items.filter((_, n) => n !== i),
                  )
                }
              />
            </div>
            <Field label={t('imageUrl')} path={[...path, 'items', i, 'media', 'url']} type="url" />
            <Field label={t('alt')} path={[...path, 'items', i, 'description']} />
            <CheckField
              label={t('spoiler')}
              checked={item.spoiler}
              onChange={(v) => update([...path, 'items', i, 'spoiler'], v)}
            />
          </div>
        ))}
        <button
          type="button"
          className="text-btn"
          disabled={block.items?.length >= 10}
          onClick={() =>
            update([...path, 'items'], [...(block.items ?? []), { media: { url: '' }, description: '' }])
          }
        >
          <Plus size={15} />
          {t('addImage')}
        </button>
      </>
    )
  if (block.type === 1 && block.components?.every((c) => c.type === 2 && c.style === 5))
    return (
      <>
        {block.components.map((b, i) => (
          <div className="sub-item" key={i}>
            <div className="row-title">
              <strong>
                {t('button')} {i + 1}
              </strong>
              <IconButton
                icon={Trash2}
                label={t('remove')}
                onClick={() =>
                  update(
                    [...path, 'components'],
                    block.components.filter((_, n) => n !== i),
                  )
                }
              />
            </div>
            <div className="two-col">
              <Field label={t('label')} path={[...path, 'components', i, 'label']} max={80} />
              <Field label={t('link')} path={[...path, 'components', i, 'url']} type="url" />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="text-btn"
          disabled={block.components.length >= 5}
          onClick={() =>
            update(
              [...path, 'components'],
              [
                ...block.components,
                {
                  type: 2,
                  style: 5,
                  label: 'Novo link',
                  url: 'https://branilist.com',
                },
              ],
            )
          }
        >
          <Plus size={15} />
          {t('addButton')}
        </button>
      </>
    )
  return (
    <div>
      <p className="help">{t('advancedHint')}</p>
      <textarea
        className="code-input"
        aria-label={t('advanced')}
        defaultValue={JSON.stringify(block, null, 2)}
        onBlur={(e) => {
          try {
            const next = JSON.parse(e.target.value)
            checkBlock(next)
            update(path, next)
          } catch {
            notify(t('jsonError'))
          }
        }}
      />
    </div>
  )
}
function V2Editor() {
  const t = useStudio().tr
  const { draft, update, containerIndex, setContainerIndex } = useStudio()
  const index = Math.min(containerIndex, Math.max(0, draft.components.length - 1)),
    container = draft.components[index],
    isContainer = container?.type === 17
  const path = isContainer ? ['components', index, 'components'] : ['components']
  const blocks = isContainer ? container.components : draft.components
  const labels = {
    10: 'text',
    9: 'section',
    12: 'gallery',
    14: 'separator',
    1: 'buttons',
  }
  const icons = {
    10: Type,
    9: MessageSquareText,
    12: ImageIcon,
    14: Minus,
    1: LinkIcon,
  }
  return (
    <>
      <div className="v2-toolbar">
        <label className="field">
          <span>{t('container')}</span>
          <select value={index} onChange={(e) => setContainerIndex(Number(e.target.value))}>
            {draft.components.map((c, i) => (
              <option key={i} value={i}>
                {c.type === 17 ? `${t('container')} ${i + 1}` : t('root')}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            update(
              ['components'],
              [
                ...draft.components,
                {
                  type: 17,
                  accent_color: 0xff9955,
                  components: [newBlock(10)],
                },
              ],
            )
            setContainerIndex(draft.components.length)
          }}
        >
          <Plus size={15} />
          {t('addContainer')}
        </button>
      </div>
      {isContainer && (
        <div className="container-controls">
          <label className="color-field">
            <span>{t('color')}</span>
            <div>
              <input
                type="color"
                value={
                  '#' +
                  Number(container.accent_color ?? 0xff9955)
                    .toString(16)
                    .padStart(6, '0')
                }
                onChange={(e) =>
                  update(['components', index, 'accent_color'], parseInt(e.target.value.slice(1), 16))
                }
              />
              <code>
                {'#' +
                  Number(container.accent_color ?? 0xff9955)
                    .toString(16)
                    .padStart(6, '0')
                    .toUpperCase()}
              </code>
            </div>
          </label>
          <CheckField
            label={t('spoiler')}
            checked={container.spoiler}
            onChange={(v) => update(['components', index, 'spoiler'], v)}
          />
          <IconButton
            icon={Trash2}
            label={`${t('remove')} ${t('container')}`}
            onClick={() => {
              update(
                ['components'],
                draft.components.filter((_, i) => i !== index),
              )
              setContainerIndex(0)
            }}
          />
        </div>
      )}
      <div className="blocks-list">
        {(blocks ?? []).map((block, i) => {
          const Icon = icons[block.type] ?? Code2
          return (
            <details className="block-card" key={`${index}-${i}-${block.type}`} open={i === 0}>
              <summary>
                <span>
                  <GripVertical size={15} />
                  <Icon size={16} />
                  {t(labels[block.type] ?? 'advanced')}
                </span>
                <ChevronDown size={15} />
              </summary>
              <div className="block-body">
                <div className="block-tools">
                  <ArrayTools path={path} index={i} items={blocks} />
                </div>
                <BlockFields block={block} path={[...path, i]} />
              </div>
            </details>
          )
        })}
      </div>
      {!blocks?.length && <div className="empty-state">{t('empty')}</div>}
      <div className="add-blocks">
        <span>{t('addBlock')}</span>
        <div>
          {[10, 9, 12, 14, 1].map((type) => {
            const Icon = icons[type]
            return (
              <button
                type="button"
                key={type}
                onClick={() => update(path, [...(blocks ?? []), newBlock(type)])}
              >
                <Icon size={17} />
                {t(labels[type])}
              </button>
            )
          })}
        </div>
      </div>
      <p className="help">{t('modeHint')}</p>
    </>
  )
}
function Markdown({ text: content = '' }) {
  const t = useStudio().tr
  const senderName = useStudio().context.user
  const parts = String(content).split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`|<@\d+>)/g)
  return (
    <span className="md">
      {parts.map((part, i) =>
        part.startsWith('**') ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : part.startsWith('[') ? (
          (() => {
            const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
            return m && safeURL(m[2]) ? (
              <a key={i} href={safeURL(m[2])} target="_blank" rel="noreferrer">
                {m[1]}
              </a>
            ) : (
              part
            )
          })()
        ) : part.startsWith('`') ? (
          <code key={i}>{part.slice(1, -1)}</code>
        ) : /^<@\d+>$/.test(part) ? (
          <span className="mention" key={i}>
            @{senderName}
          </span>
        ) : (
          part
        ),
      )}
    </span>
  )
}
function Picture({ url, alt = '', className = '' }) {
  const t = useStudio().tr
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])
  return !failed && safeURL(url) ? (
    <img src={safeURL(url)} alt={alt} className={className} onError={() => setFailed(true)} />
  ) : (
    <span className={`image-fallback ${className}`} aria-label={alt || t('image')}>
      <ImageIcon size={20} />
    </span>
  )
}
function NativeBlock({ block }) {
  const t = useStudio().tr
  if (block.type === 17)
    return (
      <div
        className={`v2-container ${block.spoiler ? 'spoiler-preview' : ''}`}
        style={{
          '--message-color':
            '#' +
            Number(block.accent_color ?? 0xff9955)
              .toString(16)
              .padStart(6, '0'),
        }}
      >
        {block.components?.map((c, i) => (
          <NativeBlock key={i} block={c} />
        ))}
      </div>
    )
  if (block.type === 10) {
    const value = String(block.content ?? '')
    return (
      <div className="native-text">
        {value.split('\n').map((line, i) =>
          /^#{1,3} /.test(line) ? (
            <div className={`discord-heading heading-${line.match(/^#+/)[0].length}`} key={i}>
              <Markdown text={line.replace(/^#+ /, '')} />
            </div>
          ) : (
            <div key={i}>
              <Markdown text={line || '\u00a0'} />
            </div>
          ),
        )}
      </div>
    )
  }
  if (block.type === 9)
    return (
      <div className="native-section">
        <div>
          {block.components?.map((c, i) => (
            <NativeBlock key={i} block={c} />
          ))}
        </div>
        {block.accessory?.type === 11 ? (
          <Picture
            url={block.accessory.media?.url}
            alt={block.accessory.description}
            className="native-thumbnail"
          />
        ) : (
          block.accessory && <NativeBlock block={block.accessory} />
        )}
      </div>
    )
  if (block.type === 14)
    return (
      <div
        className={`native-divider ${block.divider ? 'line' : ''} ${block.spacing === 2 ? 'large' : ''}`}
      />
    )
  if (block.type === 12)
    return (
      <div className="native-gallery">
        {block.items?.map((item, i) => (
          <Picture
            key={i}
            url={item.media?.url}
            alt={item.description}
            className={item.spoiler ? 'spoiler-preview' : ''}
          />
        ))}
      </div>
    )
  if (block.type === 1)
    return (
      <div className="native-actions">
        {block.components?.map((c, i) => (
          <NativeBlock key={i} block={c} />
        ))}
      </div>
    )
  if (block.type === 2)
    return (
      <a
        className="native-button"
        href={safeURL(block.url)}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          if (!safeURL(block.url)) e.preventDefault()
        }}
      >
        {block.label || t('button')}
        <ExternalLink size={12} />
      </a>
    )
  return (
    <div className="advanced-preview">
      <Code2 size={16} />
      {t('advanced')}
    </div>
  )
}
function MessagePreview() {
  const t = useStudio().tr
  const { draft, context, device, setDevice } = useStudio()
  let p
  try {
    p = makePayload(draft, context)
  } catch {
    p = {}
  }
  return (
    <>
      <div className="preview-title">
        <span>
          <Eye size={17} />
          {t('live')}
          <i />
        </span>
        <div className="device-control">
          <IconButton
            icon={Monitor}
            label="Desktop"
            disabled={device === 'desktop'}
            onClick={() => setDevice('desktop')}
          />
          <IconButton
            icon={Smartphone}
            label={t('preview') + ' · Mobile'}
            disabled={device === 'mobile'}
            onClick={() => setDevice('mobile')}
          />
        </div>
      </div>
      <div className={'discord-window ' + (device === 'mobile' ? 'phone' : '')}>
        <div className="discord-channel">
          <Hash size={19} />
          {context.channel}
          <span>Discord</span>
        </div>
        <div className="discord-message">
          <div className="message-avatar">
            {draft.sender.type === 'webhook' && safeURL(p.avatar_url) ? (
              <Picture url={p.avatar_url} alt="" />
            ) : (
              <span>B</span>
            )}
          </div>
          <div className="discord-message-body">
            <div className="message-author">
              {draft.sender.type === 'webhook' ? p.username : 'Branilist Bot'}
              <span>APP</span>
              <time>{context.time}</time>
            </div>
            {draft.mode === 'classic' ? (
              <>
                {p.content && (
                  <div className="message-content">
                    <Markdown text={p.content} />
                  </div>
                )}
                {p.embeds?.map((embed, i) => (
                  <div
                    key={i}
                    className="classic-embed"
                    style={{
                      '--message-color':
                        '#' +
                        Number(embed.color ?? 0xff9955)
                          .toString(16)
                          .padStart(6, '0'),
                    }}
                  >
                    {embed.author?.name && (
                      <div className="embed-author">
                        {embed.author.icon_url && <Picture url={embed.author.icon_url} alt="" />}
                        <Markdown text={embed.author.name} />
                      </div>
                    )}
                    <div className="classic-copy">
                      {embed.thumbnail?.url && (
                        <Picture url={embed.thumbnail.url} className="classic-thumbnail" alt="" />
                      )}
                      {embed.title && (
                        <div className="embed-title">
                          <a href={safeURL(embed.url)} target="_blank" rel="noreferrer">
                            <Markdown text={embed.title} />
                          </a>
                        </div>
                      )}
                      {embed.description && (
                        <div className="embed-description">
                          <Markdown text={embed.description} />
                        </div>
                      )}
                    </div>
                    {embed.fields?.length > 0 && (
                      <div className="embed-fields">
                        {embed.fields.map((field, j) => (
                          <div key={j} className={field.inline ? 'inline' : ''}>
                            <strong>
                              <Markdown text={field.name} />
                            </strong>
                            <Markdown text={field.value} />
                          </div>
                        ))}
                      </div>
                    )}
                    {embed.image?.url && <Picture url={embed.image.url} className="embed-image" alt="" />}
                    {(embed.footer?.text || embed.timestamp) && (
                      <div className="embed-footer">
                        {embed.footer?.icon_url && <Picture url={embed.footer.icon_url} alt="" />}
                        {embed.footer?.text}
                        {embed.timestamp && <span> · {context.date}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : (
              p.components?.map((c, i) => <NativeBlock key={i} block={c} />)
            )}
          </div>
        </div>
        <div className="discord-preview-note">
          <Eye size={13} />
          {t('sampleHint')}
        </div>
      </div>
    </>
  )
}
function Delivery() {
  const t = useStudio().tr
  const { draft, update, context, channelChoices } = useStudio()
  return (
    <section className="delivery">
      <h2>
        <Send size={17} />
        {t('destination')}
      </h2>
      <label className="field">
        <span>{t('channel')}</span>
        <select
          aria-label={t('channel')}
          value={draft.channelId}
          onChange={(e) => {
            update(['channelId'], e.target.value)
          }}
        >
          <option value="">{t('chooseChannel')}</option>
          {channelChoices.map((c) => (
            <option key={c.id} value={c.id}>
              # {c.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="sender-options">
        <legend>{t('sendAs')}</legend>
        {[
          ['bot', Bot],
          ['webhook', Webhook],
        ].map(([value, Icon]) => (
          <label key={value} className={draft.sender.type === value ? 'checked' : ''}>
            <input
              type="radio"
              name="sender"
              value={value}
              checked={draft.sender.type === value}
              onChange={() => update(['sender', 'type'], value)}
            />
            <Icon size={17} />
            {t(value)}
          </label>
        ))}
      </fieldset>
      {draft.sender.type === 'webhook' && (
        <div className="webhook-fields">
          <Field label={t('webhookName')} path={['sender', 'name']} max={80} />
          <Field
            label={t('webhookAvatar')}
            path={['sender', 'avatar']}
            type="url"
            placeholder="{{serverIcon}}"
          />
          <p className="permission-hint">
            <ShieldCheck size={15} />
            {t('webhookHint')}
          </p>
        </div>
      )}
      <details className="mentions-settings">
        <summary>
          {t('mentions')}
          <ChevronDown size={14} />
        </summary>
        {[
          ['users', 'mentionUsers'],
          ['roles', 'mentionRoles'],
          ['everyone', 'mentionEveryone'],
        ].map(([key, label]) => (
          <CheckField
            key={key}
            label={t(label)}
            checked={draft.mentions.includes(key)}
            onChange={(v) =>
              update(['mentions'], v ? [...draft.mentions, key] : draft.mentions.filter((m) => m !== key))
            }
          />
        ))}
      </details>
    </section>
  )
}
function Modal({ title, children, onClose, wide = false }) {
  const t = useStudio().tr
  const ref = useRef(null)
  useEffect(() => {
    ref.current?.showModal()
    return () => ref.current?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className={wide ? 'wide' : ''}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <IconButton icon={X} label={t('close')} onClick={onClose} />
      </div>
      {children}
    </dialog>
  )
}
function JSONEditor() {
  const t = useStudio().tr
  const { draft, setDraft, context, notify } = useStudio()
  const [value, setValue] = useState(() => JSON.stringify(makePayload(draft, context, false), null, 2))
  const [error, setError] = useState('')
  return (
    <section className="json-editor">
      <p className="help">{t('jsonHint')}</p>
      <textarea
        aria-label={t('json')}
        className="code-input"
        spellCheck="false"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="button secondary"
        onClick={() => {
          try {
            const next = fromJSON(value, draft)
            setDraft(next)
            setError('')
            notify(t('imported'))
          } catch (e) {
            setError(t('jsonError'))
          }
        }}
      >
        <Check size={16} />
        {t('applyJson')}
      </button>
    </section>
  )
}
export function StudioEditor({ initialDraft, variables, channels, locale, onSave, onSend, onError, demo }) {
  const [draft, setDraft] = useState(() => clone(initialDraft))
  const lang = locale
  const t = (key) => studioText(lang, key)
  const context = {
    ...variables,
    channel: channels.find((c) => c.id === draft.channelId)?.name ?? '',
    channelId: draft.channelId,
  }
  const [busy, setBusy] = useState(false),
    [sendError, setSendError] = useState(''),
    [result, setResult] = useState(null)
  const sending = useRef(false),
    sendKey = useRef({ fingerprint: '', id: '' })
  const [tab, setTab] = useState('editor'),
    [embedIndex, setEmbedIndex] = useState(0),
    [containerIndex, setContainerIndex] = useState(0),
    [device, setDevice] = useState('desktop'),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(''),
    [mobilePanel, setMobilePanel] = useState('editor'),
    [jsonValue, setJSONValue] = useState(''),
    [importError, setImportError] = useState(''),
    [exportKind, setExportKind] = useState('template')
  const lastField = useRef(null),
    saved = useRef(JSON.stringify(draft)),
    file = useRef(null),
    toastTimer = useRef()
  const [saveRevision, setSaveRevision] = useState(0)
  const update = (path, value) => setDraft((prev) => change(prev, path, value))
  const notify = (message) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 4500)
  }
  const report = inspect(draft, context, t),
    dirty = saved.current !== JSON.stringify(draft)
  if (!channels.some((c) => c.id === draft.channelId)) report.errors.push(t('chooseChannel'))
  if (draft.sender.type === 'webhook' && !channels.find((c) => c.id === draft.channelId)?.webhook)
    report.errors.push(t('webhookUnavailable'))
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(t('discard'))) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    addEventListener('beforeunload', warn)
    return () => removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t('studio') + ' · Branilist Bot'
  }, [lang])
  function insertVariable(name) {
    const target = lastField.current
    if (!target?.isConnected || !target.dataset.path) {
      notify(t('noSelection'))
      return
    }
    const path = JSON.parse(target.dataset.path),
      old = String(at(draft, path) ?? ''),
      start = target.selectionStart ?? old.length,
      end = target.selectionEnd ?? start,
      token = '{{' + name + '}}'
    update(path, old.slice(0, start) + token + old.slice(end))
    setModal(null)
    requestAnimationFrame(() => {
      target.focus()
      target.setSelectionRange(start + token.length, start + token.length)
    })
  }
  async function save() {
    if (sending.current) return
    setBusy(true)
    try {
      const snapshot = clone(draft)
      await onSave(snapshot)
      saved.current = JSON.stringify(snapshot)
      setSaveRevision((v) => v + 1)
      notify(t('saved'))
    } catch (error) {
      notify(onError(error))
    } finally {
      setBusy(false)
    }
  }
  async function send() {
    if (sending.current) return
    sending.current = true
    setBusy(true)
    setSendError('')
    const fingerprint = JSON.stringify(draft)
    if (sendKey.current.fingerprint !== fingerprint)
      sendKey.current = { fingerprint, id: crypto.randomUUID() }
    try {
      const response = await onSend(clone(draft), sendKey.current.id)
      sendKey.current = { fingerprint: '', id: '' }
      setResult(response)
      setModal(null)
      notify(t(response.demo ? 'simulated' : 'sent'))
    } catch (error) {
      setSendError(onError(error))
    } finally {
      sending.current = false
      setBusy(false)
    }
  }
  const exported = () =>
    exportKind === 'template'
      ? clone(draft)
      : (() => {
          try {
            return makePayload(draft, context, true)
          } catch {
            return { error: t('invalid') }
          }
        })()
  function download() {
    const blob = new Blob([JSON.stringify(exported(), null, 2)], {
        type: 'application/json',
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a')
    a.href = url
    a.download = exportKind === 'template' ? 'branilist-modelo.json' : 'branilist-mensagem.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function copyJSON() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(exported(), null, 2))
      notify(t('copied'))
    } catch {
      notify(t('copyError'))
    }
  }
  const value = {
    tr: t,
    draft,
    setDraft,
    update,
    context,
    channelChoices: channels,
    lang,
    embedIndex,
    setEmbedIndex,
    containerIndex,
    setContainerIndex,
    device,
    setDevice,
    lastField,
    notify,
  }
  return (
    <AppContext.Provider value={value}>
      <div className="message-studio">
        <div className="studio-main">
          <div className="page-heading">
            <div>
              <h1>{t('studio')}</h1>
              <p>{t('studioDesc')}</p>
            </div>
            <div className="page-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setJSONValue('')
                  setImportError('')
                  setModal('import')
                }}
              >
                <Upload size={16} />
                {t('import')}
              </button>
              <button type="button" className="button secondary" onClick={() => setModal('export')}>
                <Download size={16} />
                {t('export')}
              </button>
            </div>
          </div>
          <div className="draft-name">
            <label htmlFor="draft-name" className="sr-only">
              {t('name')}
            </label>
            <input
              id="draft-name"
              maxLength={100}
              value={draft.name}
              onChange={(e) => update(['name'], e.target.value)}
            />
            <span>
              <i />
              {t('local')}
            </span>
          </div>
          <div className="mobile-panels">
            <button
              type="button"
              className={mobilePanel === 'editor' ? 'selected' : ''}
              onClick={() => setMobilePanel('editor')}
            >
              {t('editor')}
            </button>
            <button
              type="button"
              className={mobilePanel === 'preview' ? 'selected' : ''}
              onClick={() => setMobilePanel('preview')}
            >
              {t('preview')}
            </button>
          </div>
          <div className="studio-grid">
            <section
              className={'editor-pane ' + (mobilePanel === 'preview' ? 'mobile-hidden' : '')}
              aria-label={t('editor')}
            >
              <div className="editor-top">
                <div className="mode-picker" role="group" aria-label={t('format')}>
                  <button
                    type="button"
                    aria-pressed={draft.mode === 'classic'}
                    onClick={() => update(['mode'], 'classic')}
                  >
                    <MessageSquareText size={16} />
                    {t('classic')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={draft.mode === 'v2'}
                    onClick={() => update(['mode'], 'v2')}
                  >
                    <SlidersHorizontal size={16} />
                    {t('v2')}
                  </button>
                </div>
                <button
                  type="button"
                  className="text-btn variables-action"
                  onClick={() => setModal('variables')}
                >
                  <Braces size={16} />
                  {t('variables')}
                </button>
              </div>
              <div className="editor-tabs" role="group" aria-label={t('edit')}>
                <button type="button" aria-pressed={tab === 'editor'} onClick={() => setTab('editor')}>
                  <Palette size={15} />
                  {t('editor')}
                </button>
                <button type="button" aria-pressed={tab === 'json'} onClick={() => setTab('json')}>
                  <Code2 size={15} />
                  {t('json')}
                </button>
              </div>
              {tab === 'json' ? (
                <JSONEditor key={draft.mode} />
              ) : draft.mode === 'classic' ? (
                <ClassicEditor />
              ) : (
                <V2Editor />
              )}
            </section>
            <aside className={'preview-pane ' + (mobilePanel === 'editor' ? 'mobile-hidden' : '')}>
              <MessagePreview />
              <button type="button" className="sample-button" onClick={() => setModal('context')}>
                <SlidersHorizontal size={14} />
                {t('sampleData')}
                <ChevronRight size={14} />
              </button>
              <Delivery />
            </aside>
          </div>
          {report.errors.length > 0 && (
            <div className="errors" role="alert">
              <strong>
                <AlertCircle size={17} />
                {t('invalid')}
              </strong>
              <ul>
                {report.errors.slice(0, 8).map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <footer className="savebar">
          <div className={report.errors.length ? 'invalid-status' : 'valid-status'}>
            {report.errors.length ? <AlertCircle size={17} /> : <Check size={17} />}
            <span>
              <strong>{report.errors.length ? t('invalid') : t('valid')}</strong>
              <small>
                {draft.mode === 'classic'
                  ? `${draft.embeds.length} embed · ${report.chars}/6000`
                  : `${report.components}/40 · ${report.chars}/4000`}{' '}
                · {dirty ? t('pending') : t('local')}
              </small>
            </span>
          </div>
          <div>
            <button type="button" className="button secondary" onClick={save} disabled={busy}>
              <Save size={16} />
              <span>{t('save')}</span>
            </button>
            <button
              type="button"
              className="button primary"
              disabled={busy || report.errors.length > 0}
              onClick={() => {
                setSendError('')
                setModal('review')
              }}
            >
              <Send size={16} />
              {t('review')}
            </button>
          </div>
        </footer>
        {modal === 'variables' && (
          <Modal
            title={t('variables')}
            onClose={() => {
              if (!sending.current) setModal(null)
            }}
          >
            <p className="modal-description">{t('variablesHint')}</p>
            <div className="variable-list">
              {Object.entries(variableNames).map(([name, description]) => (
                <button type="button" key={name} onClick={() => insertVariable(name)}>
                  <code>{'{{' + name + '}}'}</code>
                  <span>
                    {description[['pt-BR', 'en', 'es'].indexOf(lang)]}
                    <small>{String(context[name]).slice(0, 62)}</small>
                  </span>
                  <Plus size={16} />
                </button>
              ))}
            </div>
          </Modal>
        )}
        {modal === 'context' && (
          <Modal title={t('context')} onClose={() => setModal(null)}>
            <p className="modal-description">{t('contextNote')}</p>
            <dl className="send-summary">
              {Object.entries(context).map(([key, value]) => (
                <div key={key}>
                  <dt>
                    <code>{'{{' + key + '}}'}</code>
                  </dt>
                  <dd>{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </Modal>
        )}
        {modal === 'import' && (
          <Modal
            title={t('import')}
            onClose={() => {
              if (!sending.current) setModal(null)
            }}
            wide
          >
            <p className="modal-description">{t('importHint')}</p>
            <input
              className="sr-only"
              ref={file}
              type="file"
              accept=".json,application/json"
              aria-label={t('pickFile')}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) {
                  if (f.size > 256000) {
                    setImportError('JSON > 256 KB')
                    return
                  }
                  setJSONValue(await f.text())
                  setImportError('')
                }
              }}
            />
            <button type="button" className="button secondary" onClick={() => file.current?.click()}>
              <FileJson size={16} />
              {t('pickFile')}
            </button>
            <textarea
              aria-label="JSON"
              className="code-input import-input"
              placeholder={'{\n  "embeds": [...]\n}'}
              spellCheck="false"
              value={jsonValue}
              onChange={(e) => setJSONValue(e.target.value)}
            />
            {importError && (
              <p className="error-text" role="alert">
                {importError}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="button primary"
                disabled={!jsonValue.trim()}
                onClick={() => {
                  try {
                    const next = fromJSON(jsonValue, draft)
                    setDraft(next)
                    setEmbedIndex(0)
                    setContainerIndex(0)
                    setModal(null)
                    notify(t('imported'))
                  } catch (e) {
                    setImportError(t('jsonError'))
                  }
                }}
              >
                {t('replace')}
              </button>
            </div>
          </Modal>
        )}
        {modal === 'export' && (
          <Modal
            title={t('export')}
            onClose={() => {
              if (!sending.current) setModal(null)
            }}
            wide
          >
            <p className="modal-description">{t('exportHint')}</p>
            <div className="export-options">
              {[
                ['template', 'templateHint'],
                ['payload', 'payloadHint'],
              ].map(([key, hint]) => (
                <label key={key} className={exportKind === key ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="export-kind"
                    checked={exportKind === key}
                    onChange={() => setExportKind(key)}
                  />
                  <span>
                    <strong>{t(key)}</strong>
                    <small>{t(hint)}</small>
                  </span>
                </label>
              ))}
            </div>
            <textarea
              aria-label={t('export')}
              className="code-input export-input"
              readOnly
              value={JSON.stringify(exported(), null, 2)}
            />
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={copyJSON}>
                <Copy size={16} />
                {t('copy')}
              </button>
              <button type="button" className="button primary" onClick={download}>
                <Download size={16} />
                {t('download')}
              </button>
            </div>
          </Modal>
        )}
        {modal === 'review' && (
          <Modal
            title={t('review')}
            onClose={() => {
              if (!sending.current) setModal(null)
            }}
          >
            <p className="modal-description">{t(demo ? 'simulateHint' : 'sendHint')}</p>
            {sendError && (
              <p className="error-text" role="alert">
                {sendError}
              </p>
            )}
            <dl className="send-summary">
              <div>
                <dt>{t('channel')}</dt>
                <dd># {context.channel}</dd>
              </div>
              <div>
                <dt>{t('sendAs')}</dt>
                <dd>
                  {draft.sender.type === 'webhook' ? resolve(draft.sender.name, context) : 'Branilist Bot'} ·{' '}
                  {t(draft.sender.type)}
                </dd>
              </div>
              <div>
                <dt>{t('format')}</dt>
                <dd>{t(draft.mode === 'classic' ? 'classic' : 'v2')}</dd>
              </div>
            </dl>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="button primary"
                disabled={busy || report.errors.length > 0}
                onClick={send}
              >
                <Send size={16} />
                {t(busy ? 'sending' : demo ? 'simulate' : 'send')}
              </button>
            </div>
          </Modal>
        )}
        {result?.url && (
          <p className="studio-result" role="status">
            <a href={safeURL(result.url)} target="_blank" rel="noreferrer">
              {t('viewSent')} <ExternalLink size={14} />
            </a>
          </p>
        )}
        {toast && (
          <div className="toast" role="status">
            <Check size={16} />
            {toast}
            <IconButton icon={X} label={t('close')} onClick={() => setToast('')} />
          </div>
        )}
      </div>
    </AppContext.Provider>
  )
}
