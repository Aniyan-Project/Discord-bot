import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { randomUUID } from 'node:crypto'
import { newTicketPanel, defaultTicketSettings } from '../../shared/tickets.js'
const guild = '1100000000000000001',
  base = `/api/guilds/${guild}/tickets`,
  route = `/dashboard/${guild}/tickets`
test('ticket editor persists, publishes after review, creates and closes a private demo ticket', async ({
  page,
  request,
}) => {
  const session = await (await request.get('/api/session')).json(),
    headers = { origin: 'http://localhost:5173', 'x-csrf-token': session.csrfToken }
  const context = await (await request.get(base + '/context')).json()
  await request.put(base + '/settings', {
    headers,
    data: {
      revision: context.revision,
      settings: {
        ...defaultTicketSettings,
        categoryId: context.resources.categories[0].id,
        supportRoleIds: [context.resources.roles[0].id],
        cooldownSeconds: 0,
      },
    },
  })
  const panel = newTicketPanel()
  panel.name = 'Painel de teste ' + randomUUID().slice(0, 6)
  panel.channelId = context.resources.channels[0].id
  panel.topics[0]!.maxPerUser = 10
  expect((await request.put(base + '/panels', { headers, data: { panel, revision: 0 } })).ok()).toBeTruthy()
  await page.goto(route + '/panels')
  const card = page.locator('.panel-card').filter({ hasText: panel.name })
  await card.getByRole('button', { name: 'Editar painel', exact: true }).click()
  await page.getByLabel('Título', { exact: true }).fill('Fale com nossa equipe')
  await expect(page.locator('.discord-message h3')).toHaveText('Fale com nossa equipe')
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Salvo.')
  await page.reload()
  await expect(card).toContainText('Fale com nossa equipe')
  await card.getByRole('button', { name: 'Publicar', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(context.resources.channels[0].name)
  await page.getByRole('button', { name: 'Confirmar publicação', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(card).toContainText('Publicado')
  await card.getByLabel('Testar abertura', { exact: true }).selectOption(panel.topics[0]!.id)
  await page.getByLabel('Descreva o problema.', { exact: true }).fill('Teste do sistema de atendimento')
  await page.getByRole('button', { name: 'Criar atendimento privado', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Seu atendimento foi criado.')
  await page.getByRole('dialog').getByRole('button', { name: 'Voltar', exact: true }).click()
  await page.goto(route + '/history')
  await page.locator('.ticket-link').first().click()
  await page.getByRole('button', { name: 'Assumir ticket', exact: true }).click()
  await page.getByLabel('Nota interna', { exact: true }).fill('Nota da equipe')
  await page.getByRole('button', { name: 'Adicionar nota', exact: true }).click()
  await expect(page.locator('.internal-note')).toContainText('Nota da equipe')
  await page.getByRole('button', { name: 'Encerrar ticket', exact: true }).click()
  await page.getByLabel('Motivo do encerramento', { exact: true }).fill('Teste concluído')
  await page.getByRole('dialog').getByRole('button', { name: 'Encerrar ticket', exact: true }).last().click()
  await expect(page.getByRole('dialog').locator('.badge')).toHaveText('Fechado')
  await page.keyboard.press('Escape')
  expect((await new AxeBuilder({ page }).include('.tickets-page').analyze()).violations).toEqual([])
})
test('ticket menu and account remain accessible at 1366x768 and mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(route + '/panels')
  await expect(page.getByRole('heading', { name: 'Painéis de abertura', exact: true })).toBeVisible()
  const bounds = await page.locator('.sidebar').evaluate((el) => {
    const nav = el.querySelector('.sidebar-nav')!,
      footer = el.querySelector('.sidebar-bottom')!
    return { scroll: nav.scrollHeight > nav.clientHeight, bottom: footer.getBoundingClientRect().bottom }
  })
  expect(bounds.scroll).toBeTruthy()
  expect(bounds.bottom).toBeLessThanOrEqual(768)
  await page.locator('.sidebar-nav').getByRole('link', { name: 'Comandos', exact: true }).click()
  await expect(page).toHaveURL(/commands$/)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(route + '/panels')
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click()
  await page.locator('.mobile-nav').getByRole('link', { name: 'Histórico de tickets', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Histórico de tickets', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBeFalsy()
})
test('ticket navigation and settings support English and Spanish', async ({ page }) => {
  await page.goto(route + '/settings?lang=en')
  await expect(page.getByRole('heading', { name: 'Ticket settings', exact: true })).toBeVisible()
  await page.locator('.dashboard-header select').selectOption('es')
  await expect(page.getByRole('heading', { name: 'Configuración de tickets', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar configuración', exact: true })).toBeVisible()
})
