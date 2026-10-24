import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { TicketRecord, Transcript } from '../shared/tickets.js'
import { newTicketPanel, defaultTicketSettings } from '../shared/tickets.js'
import { documentFor, renderTranscript } from '../server/tickets/transcript.js'
const ticket: TicketRecord = {
  id: randomUUID(),
  guildId: '1100000000000000001',
  number: 2,
  panelId: randomUUID(),
  topic: newTicketPanel().topics[0]!,
  authorId: '1000000000000000001',
  authorName: 'Author',
  status: 'closed',
  staffId: null,
  channelId: null,
  staffThreadId: '1700000000000000001',
  createdAt: Date.now() - 60000,
  lastActivity: Date.now(),
  closedAt: Date.now(),
  reason: 'Resolved',
  revision: 1,
  settings: defaultTicketSettings,
  answers: {},
  notes: [{ actor: 'staff', at: Date.now(), text: 'SECRET INTERNAL NOTE' }],
}
test('HTML transcript escapes messages and embed content, rejects unsafe URLs and does not include internal notes', () => {
  const data: Transcript = {
    messages: [
      {
        id: '1',
        author: '<script>evil()</script>',
        authorId: 'a',
        at: Date.now(),
        content: '</script><img src=x onerror=evil()>',
        attachments: ['javascript:evil()'],
        avatar: 'https://evil.example/track',
        files: [{ url: 'data:text/html,evil', name: 'bad', size: 1 }],
        embeds: [
          {
            title: '<img src=x onerror=evil()>',
            description: 'unsafe <iframe>',
            fields: [{ name: '<script>', value: '</script>' }],
          },
        ],
      },
    ],
    truncated: false,
    contentAvailable: true,
    capturedAt: Date.now(),
  }
  const document = documentFor(ticket, data),
    rendered = renderTranscript(document, 'testnonce')
  assert.ok(!JSON.stringify(document).includes('SECRET INTERNAL NOTE'))
  assert.ok(!JSON.stringify(document).includes('staffThreadId'))
  assert.ok(!rendered.html.includes('<img src=x'))
  assert.ok(!rendered.html.includes('<script>evil()'))
  assert.ok(!rendered.html.includes('href="javascript:'))
  assert.ok(!rendered.html.includes('src="https://evil.example'))
  assert.ok(rendered.html.includes('&lt;iframe&gt;'))
  assert.ok(rendered.html.includes('\\u003c/script\\u003e'))
  assert.match(rendered.csp, /script-src 'nonce-testnonce'/)
  assert.match(rendered.csp, /frame-ancestors 'none'/)
})
test('legacy snapshots render attachments, missing metadata, limited-content and truncation states', () => {
  const data: Transcript = {
    messages: [
      {
        id: '1',
        author: 'Old user',
        authorId: 'u',
        at: Date.now(),
        content: 'Legacy message',
        attachments: ['https://cdn.discordapp.com/attachments/example/file.pdf'],
      },
    ],
    truncated: true,
    contentAvailable: false,
    capturedAt: Date.now(),
  }
  const html = renderTranscript(documentFor(ticket, data)).html
  assert.ok(html.includes('Legacy message'))
  assert.ok(html.includes('href="https://cdn.discordapp.com/attachments/example/file.pdf"'))
  assert.ok(html.includes('5.000 mensagens'))
  assert.ok(html.includes('Message Content Intent'))
  assert.ok(html.includes('Baixar HTML'))
})
