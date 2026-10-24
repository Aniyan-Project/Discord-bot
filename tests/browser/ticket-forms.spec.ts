import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { randomUUID } from 'node:crypto'
import { newTicketPanel } from '../../shared/tickets.js'
const guild = '1100000000000000001',
  base = `/api/guilds/${guild}/tickets`,
  route = `/dashboard/${guild}/tickets`
test('form editor adds native field types and saves, previews, publishes and submits their answers', async ({
  page,
  request,
}) => {
  const session = await (await request.get('/api/session')).json()
  const headers = { origin: 'http://localhost:5173', 'x-csrf-token': session.csrfToken }
  const context = await (await request.get(base + '/context')).json()
  expect(
    (
      await request.put(base + '/settings', {
        headers,
        data: {
          revision: context.revision,
          settings: {
            ...context.settings,
            categoryId: context.resources.categories[0].id,
            supportRoleIds: [context.resources.roles[0].id],
            cooldownSeconds: 0,
            maxPerUser: 10,
            logChannelId: '',
            staffThread: false,
          },
        },
      })
    ).ok(),
  ).toBeTruthy()
  const panel = newTicketPanel()
  panel.name = 'Formulário completo ' + randomUUID().slice(0, 6)
  panel.channelId = context.resources.channels[0].id
  panel.topics[0]!.questions = []
  panel.topics[0]!.maxPerUser = 10
  expect((await request.put(base + '/panels', { headers, data: { panel, revision: 0 } })).ok()).toBeTruthy()
  await page.goto(route + '/panels?lang=pt-BR')
  const card = page.locator('.panel-card').filter({ hasText: panel.name })
  await card.getByRole('button', { name: 'Editar painel', exact: true }).click()
  await page.getByRole('button', { name: 'Assuntos e formulário', exact: true }).click()
  await page.getByRole('button', { name: 'Formulário', exact: true }).click()
  for (const [style, label] of [
    ['multi', 'Áreas afetadas'],
    ['select', 'Urgência'],
    ['radio', 'Dispositivo'],
    ['checkboxes', 'Sintomas'],
    ['checkbox', 'Li as orientações'],
  ]) {
    await page.getByLabel('Novo campo', { exact: true }).selectOption(style!)
    await page.getByRole('button', { name: 'Adicionar campo', exact: true }).click()
    const block = page.locator('.question-block').last()
    await block.locator('.question .field input').fill(label!)
    if (style !== 'checkbox')
      await block.getByLabel('Opções (uma por linha)', { exact: true }).fill('Opção A\nOpção B')
    if (style === 'multi' || style === 'checkboxes')
      await block.getByLabel('Máximo de seleções', { exact: true }).fill('2')
  }
  await expect(page.getByRole('button', { name: 'Adicionar campo', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Formulário de atendimento', exact: true }).click()
  const modal = page.getByRole('dialog')
  await expect(modal.getByLabel('Urgência', { exact: true })).toBeVisible()
  await expect(modal.getByRole('radio')).toHaveCount(2)
  await expect(modal.getByRole('checkbox')).toHaveCount(3)
  await modal.getByRole('checkbox', { name: 'Li as orientações', exact: true }).check()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Salvo.')
  await page.reload()
  await card.getByRole('button', { name: 'Publicar', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar publicação', exact: true }).click()
  await expect(modal).toHaveCount(0)
  await card.getByLabel('Testar abertura', { exact: true }).selectOption(panel.topics[0]!.id)
  await modal.getByLabel('Áreas afetadas', { exact: true }).selectOption(['Opção A', 'Opção B'])
  await modal.getByLabel('Urgência', { exact: true }).selectOption('Opção A')
  await modal.getByRole('radio', { name: 'Opção B', exact: true }).check()
  await modal
    .getByRole('group', { name: /^Sintomas/ })
    .getByRole('checkbox', { name: 'Opção A', exact: true })
    .check()
  await modal.getByRole('checkbox', { name: 'Li as orientações', exact: true }).check()
  expect((await new AxeBuilder({ page }).include('.tickets-page').analyze()).violations).toEqual([])
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBeFalsy()
  await modal.getByRole('button', { name: 'Criar atendimento privado', exact: true }).click()
  await expect(modal).toContainText('Seu atendimento foi criado.')
  await page.keyboard.press('Escape')
  const list = await (await request.get(base)).json()
  const ticket = list.tickets.find((t: { panelId: string }) => t.panelId === panel.id)
  const detail = await (await request.get(base + '/' + ticket.id)).json()
  const saved = (await (await request.get(base + '/context')).json()).panels.find(
    (p: { panel: { id: string } }) => p.panel.id === panel.id,
  )
  expect(Object.values(detail.ticket.answers)).toEqual([
    '["Opção A","Opção B"]',
    'Opção A',
    'Opção B',
    '["Opção A"]',
    'true',
  ])
  expect(saved.panel.topics[0].questions.map((q: { style: string }) => q.style)).toEqual([
    'multi',
    'select',
    'radio',
    'checkboxes',
    'checkbox',
  ])
  expect(
    (
      await request.post(base + '/' + ticket.id + '/actions', {
        headers,
        data: { action: 'close', value: 'Form test completed', revision: detail.ticket.revision },
      })
    ).ok(),
  ).toBeTruthy()
})
