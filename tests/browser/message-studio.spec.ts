import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
const url = '/dashboard/1100000000000000001/messages'
test.beforeEach(async ({ request }) => {
  const session = await (await request.get('/api/session')).json()
  const current = await (await request.get('/api/guilds/1100000000000000001/message-studio')).json()
  const draft = {
    version: 1,
    name: 'Test draft',
    mode: 'classic',
    channelId: '1200000000000000001',
    sender: { type: 'bot', name: '{{server}}', avatar: '{{serverIcon}}' },
    mentions: [],
    content: 'Hello {{user}}',
    embeds: [{ title: '{{server}}', description: '{{memberCount}} members' }],
    components: [
      {
        type: 17,
        accent_color: 16750933,
        components: [
          { type: 10, content: 'Welcome {{server}}' },
          { type: 14, divider: true, spacing: 1 },
        ],
      },
    ],
  }
  expect(
    (
      await request.put('/api/guilds/1100000000000000001/message-studio/draft', {
        headers: { origin: 'http://localhost:5173', 'x-csrf-token': session.csrfToken },
        data: { draft, revision: current.revision },
      })
    ).ok(),
  ).toBe(true)
})
test('editor uses actual server context, inserts variables and persists its draft through authenticated API', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(url)
  const title = page.getByLabel('Título', { exact: true })
  await title.fill('Clube {{server}}')
  await expect(page.locator('.embed-title')).toContainText('Clube Aniyan Project: Hub')
  await title.focus()
  await page.getByRole('button', { name: 'Variáveis', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /\{\{memberCount\}\}/ })
    .click()
  await expect(title).toHaveValue(/memberCount/)
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Rascunho salvo')
  const before = await title.inputValue()
  await page.reload()
  await expect(title).toHaveValue(before)
  expect(errors).toEqual([])
})
test('webhook identity, V2 payload export and review/simulation work together', async ({ page }) => {
  await page.goto(url)
  await page.getByRole('radio', { name: 'Webhook', exact: true }).check()
  await page.getByLabel('Nome do webhook', { exact: true }).fill('Clube {{server}}')
  await page
    .getByLabel('Avatar do webhook (URL)', { exact: true })
    .fill('https://cdn.myanimelist.net/images/anime/1015/138006l.webp')
  await expect(page.locator('.message-author')).toContainText('Clube Aniyan Project: Hub')
  await page.getByRole('button', { name: 'Components V2', exact: true }).click()
  await expect(page.locator('.v2-container')).toContainText('Welcome Aniyan Project: Hub')
  await page.getByRole('button', { name: 'Exportar JSON', exact: true }).click()
  await page.getByRole('radio', { name: /Mensagem do Discord/ }).check()
  const payload = JSON.parse(
    await page.getByRole('dialog').getByLabel('Exportar JSON', { exact: true }).inputValue(),
  )
  expect(payload.flags).toBe(32768)
  expect(payload.embeds).toBeUndefined()
  expect(payload.username).toBe('Clube Aniyan Project: Hub')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Revisar envio', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('nenhuma mensagem real')
  const response = page.waitForResponse((r) => r.url().endsWith('/message-studio/send'))
  await page.getByRole('button', { name: 'Simular envio', exact: true }).click()
  expect((await response).ok()).toBe(true)
  await expect(page.getByRole('status')).toContainText('Nenhuma mensagem foi enviada')
})
test('import accepts native JSON and rejects malformed structures without overwriting the draft', async ({
  page,
}) => {
  await page.goto(url)
  await page.getByRole('button', { name: 'Importar JSON', exact: true }).click()
  const input = page.getByRole('dialog').getByRole('textbox')
  await input.fill(JSON.stringify({ embeds: [{ title: 'Imported', description: '{{server}}' }] }))
  await page.getByRole('button', { name: 'Importar e substituir rascunho', exact: true }).click()
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Imported')
  await page.getByRole('button', { name: 'Importar JSON', exact: true }).click()
  await input.fill(JSON.stringify({ embeds: [{ fields: { bad: true } }] }))
  await page.getByRole('button', { name: 'Importar e substituir rascunho', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Imported')
})
test('languages, keyboard dialogs, mobile layout and tested-state accessibility pass', async ({ page }) => {
  await page.goto(url)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(results.violations).toEqual([])
  await page.locator('.dashboard-header select').selectOption('en')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Message builder')
  await page.locator('.dashboard-header select').selectOption('es')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creador de mensajes')
  await page.locator('.dashboard-header select').selectOption('pt-BR')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Prévia', exact: true }).click()
  await expect(page.locator('.discord-window')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click()
  await expect(page.locator('.mobile-nav')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.mobile-nav')).not.toBeVisible()
})
