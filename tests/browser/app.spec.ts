import { test, expect, type APIRequestContext } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { defaultSettings } from '../../shared/domain.js'
const guildId = '1100000000000000001'
const settingsPath = `/dashboard/${guildId}/settings`
async function mutationHeaders(request: APIRequestContext) {
  const view = await (await request.get('/api/session')).json()
  return { origin: 'http://localhost:5173', 'x-csrf-token': view.csrfToken }
}
test.beforeEach(async ({ request }) => {
  await expect.poll(async () => (await request.get('/api/health')).status()).toBe(200)
  const current = await (await request.get(`/api/guilds/${guildId}`)).json()
  const updated = await request.put(`/api/guilds/${guildId}/settings`, {
    headers: await mutationHeaders(request),
    data: { settings: defaultSettings, revision: current.revision },
  })
  expect(updated.ok()).toBe(true)
})
test('website has a clear invitation and supports all three interface languages', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('O Branilist também mora')
  await page.locator('.public-header select').selectOption('en')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Branilist belongs')
  await page.locator('.public-header select').selectOption('es')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Branilist también')
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  expect(errors).toEqual([])
})
test('server settings update preview immediately and persist after save and reload', async ({
  page,
  request,
}) => {
  await page.goto(settingsPath)
  const prefix = page.getByRole('textbox', { name: /^Prefixo/ })
  await prefix.fill('??')
  await expect(page.locator('.discord-request code')).toHaveText('??anime Frieren')
  await page
    .locator('.settings-form')
    .getByRole('combobox', { name: /^Idioma/ })
    .first()
    .selectOption('es')
  await expect(page.locator('.discord-preview')).toContainText('Episodios')
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
  await expect(page.getByText('Configurações atualizadas.', { exact: true })).toBeVisible()
  expect((await (await request.get(`/api/guilds/${guildId}`)).json()).settings.prefix).toBe('??')
  await page.reload()
  await expect(page.getByRole('textbox', { name: /^Prefixo/ })).toHaveValue('??')
})
test('discard restores form state and navigating away asks before losing changes', async ({ page }) => {
  await page.goto(settingsPath)
  await page.getByRole('textbox', { name: /^Prefixo/ }).fill('?')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.locator('.sidebar-nav').getByRole('link', { name: 'Explorar catálogo' }).click()
  await expect(page).toHaveURL(new RegExp(`${guildId}/settings$`))
  await page.getByRole('button', { name: 'Descartar', exact: true }).click()
  await expect(page.getByRole('textbox', { name: /^Prefixo/ })).toHaveValue('b!')
  await expect(page.locator('.save-bar')).toHaveCount(0)
})
test('catalog search, filters and native detail dialog work', async ({ page }) => {
  await page.goto(`/dashboard/${guildId}/catalog`)
  await page.getByRole('searchbox').fill('Frieren')
  await page.getByRole('button', { name: 'Pesquisar', exact: true }).click()
  await expect(page.locator('.catalog-grid .media-tile')).toHaveCount(1)
  await page.getByRole('button', { name: 'Detalhes', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('heading')).toContainText('Frieren')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('account library changes persist and destructive actions need confirmation', async ({
  page,
  request,
}) => {
  await page.goto('/dashboard/account')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Minha conta')
  await expect(page.locator('.library-row').first()).toBeVisible()
  const first = page.locator('.library-row').first()
  const nextProgress = Number(await first.getByRole('spinbutton').inputValue()) + 1
  await first.getByRole('spinbutton').fill(String(nextProgress))
  await first.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
  await expect(page.getByText('Progresso atualizado.', { exact: true })).toBeVisible()
  expect((await (await request.get('/api/account/library')).json()).nodes[0].progress).toBe(nextProgress)
  await page
    .locator('.library-row')
    .first()
    .getByRole('button', { name: /^Remover/ })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('mobile navigation is keyboard accessible and there is no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(settingsPath)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Abrir navegação' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('link', { name: 'Explorar catálogo' }).click()
  await expect(page).toHaveURL(new RegExp(`${guildId}/catalog$`))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).not.toHaveCount(0)
})
test('dashboard language changes translate configuration and command help', async ({ page }) => {
  await page.goto(settingsPath)
  await page.locator('.dashboard-header select').selectOption('en')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bot configuration')
  await page.locator('.dashboard-header select').selectOption('es')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Configuración del bot')
  await page.goto('/dashboard/commands')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Un comando')
  await page.getByRole('searchbox').fill('library')
  await expect(page.locator('.command-table article')).toHaveCount(1)
})
for (const path of ['/', settingsPath, '/dashboard/account', '/commands']) {
  test(`accessibility: ${path}`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(
      audit.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([])
  })
}
