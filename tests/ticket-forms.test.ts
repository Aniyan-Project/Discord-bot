import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Client, type ModalSubmitInteraction } from 'discord.js'
import {
  questionSchema,
  newTicketPanel,
  defaultTicketSettings,
  type TicketQuestion,
} from '../shared/tickets.js'
import { validAnswer, displayAnswer } from '../shared/ticket-forms.js'
import { openingForm, formAnswers } from '../server/bot/tickets/forms.js'
import { TicketService } from '../server/bot/tickets/service.js'
import { TicketDiscord } from '../server/bot/tickets/discord.js'
import { Store } from '../server/store.js'
const question = (style: TicketQuestion['style'], extra = {}) =>
  questionSchema.parse({
    id: randomUUID(),
    label: 'Detalhes',
    style,
    options: ['Conta', 'Catálogo'],
    ...extra,
  })
test('new field schemas preserve old questions and reject invalid choice definitions', () => {
  const old = questionSchema.parse({
    id: randomUUID(),
    label: 'Antiga',
    style: 'long',
    required: true,
    maxLength: 800,
  })
  assert.equal(old.minLength, 0)
  assert.deepEqual(old.options, [])
  for (const extra of [
    { options: [] },
    { options: ['Conta', 'Conta'] },
    { minChoices: 3, maxChoices: 2 },
    { maxChoices: 3 },
    { options: ['x'.repeat(101)] },
  ])
    assert.throws(() => question('multi', extra))
  assert.throws(() => question('radio', { options: ['A'] }))
  assert.throws(() => question('short', { minLength: 20, maxLength: 10 }))
})
test('all seven types serialize to native Discord modal components, including mandatory confirmation', () => {
  const expected = {
    short: 4,
    long: 4,
    select: 3,
    multi: 3,
    radio: 21,
    checkboxes: 22,
    checkbox: 22,
  } as const
  for (const [style, type] of Object.entries(expected)) {
    const q = question(style as TicketQuestion['style'], { description: 'Ajuda', placeholder: 'Escolha' })
    const topic = { ...newTicketPanel().topics[0]!, questions: [q] }
    const json = openingForm('form', topic).toJSON()
    const label = json.components[0]!
    assert.equal(label.type, 18)
    assert.ok('component' in label)
    assert.equal(label.component.type, type)
    assert.equal(label.description, 'Ajuda')
  }
  const q = question('checkbox', { required: false })
  const json = openingForm('form', { ...newTicketPanel().topics[0]!, questions: [q] }).toJSON()
  assert.ok('component' in json.components[0]!)
  assert.equal(json.components[0]!.component.type, 23)
})
test('answer validation rejects forged choices, duplicates, invalid counts and missing confirmations', () => {
  assert.equal(validAnswer(question('select'), 'Forged'), false)
  assert.equal(validAnswer(question('select'), 'Conta'), true)
  const multi = question('multi', { minChoices: 2, maxChoices: 2 })
  for (const value of ['', '{}', 'invalid', '["Conta"]', '["Conta","Conta"]', '["Conta","Forged"]'])
    assert.equal(validAnswer(multi, value), false)
  assert.equal(validAnswer(multi, '["Conta","Catálogo"]'), true)
  assert.equal(displayAnswer(multi, '["Conta","Catálogo"]'), 'Conta, Catálogo')
  assert.equal(validAnswer(question('checkbox'), 'false'), false)
  assert.equal(validAnswer(question('checkbox'), 'true'), true)
  assert.equal(validAnswer(question('checkbox', { required: false }), 'false'), true)
  assert.equal(validAnswer(question('long', { minLength: 10 }), 'curto'), false)
  assert.equal(validAnswer(question('long'), '   '), false)
})
test('Discord submission reads each component using its own accessor', () => {
  const fields = {
    getTextInputValue: () => 'Texto',
    getStringSelectValues: () => ['Conta'],
    getRadioGroup: () => 'Catálogo',
    getCheckboxGroup: () => ['confirm'],
    getCheckbox: () => false,
  } as unknown as ModalSubmitInteraction['fields']
  for (const [style, expected] of Object.entries({
    short: 'Texto',
    long: 'Texto',
    select: 'Conta',
    multi: '["Conta"]',
    radio: 'Catálogo',
    checkbox: 'true',
  })) {
    const q = question(style as TicketQuestion['style'])
    assert.equal(formAnswers({ ...newTicketPanel().topics[0]!, questions: [q] }, fields)[q.id], expected)
  }
  const q = question('checkbox', { required: false })
  assert.equal(formAnswers({ ...newTicketPanel().topics[0]!, questions: [q] }, fields)[q.id], 'false')
})
test('opening rejects invalid answers before creating a ticket and persists valid choice values', async () => {
  const key = '55'.repeat(32),
    store = new Store(':memory:', key)
  try {
    const service = new TicketService(store, new TicketDiscord(new Client({ intents: [] }), true, true), key)
    const guild = '1100000000000000001',
      user = '1000000000000000001'
    await service.saveSettings(
      guild,
      user,
      {
        ...defaultTicketSettings,
        categoryId: '1300000000000000001',
        supportRoleIds: ['1400000000000000001'],
        cooldownSeconds: 0,
      },
      0,
    )
    const panel = newTicketPanel(),
      q = question('checkboxes', { maxChoices: 2 })
    panel.channelId = '1200000000000000001'
    panel.topics[0]!.questions = [q]
    const view = await service.savePanel(guild, user, panel, 0)
    await service.publish(guild, user, panel.id, randomUUID(), view.revision)
    await assert.rejects(service.open(guild, user, panel.id, panel.topics[0]!.id, { [q.id]: '["Forged"]' }), {
      code: 'invalidInput',
    })
    assert.equal(service.repo.list(guild).length, 0)
    const record = await service.open(guild, user, panel.id, panel.topics[0]!.id, {
      [q.id]: '["Conta","Catálogo"]',
    })
    assert.equal(service.repo.get(guild, record.id)!.answers[q.id], '["Conta","Catálogo"]')
  } finally {
    store.close()
  }
})
