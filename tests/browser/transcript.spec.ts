import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { newTicketPanel, defaultTicketSettings } from '../../shared/tickets.js'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
test('authenticated transcript renders real messages, searches, exports HTML/JSON and fits mobile', async ({
  page,
  request,
}, testInfo) => {
  const base = '/api/guilds/1100000000000000001/tickets'
  const session = await (await request.get('/api/session')).json(),
    headers = { origin: 'http://localhost:5173', 'x-csrf-token': session.csrfToken }
  const context = await (await request.get(base + '/context')).json()
  expect(
    (
      await request.put(base + '/settings', {
        headers,
        data: {
          revision: context.revision,
          settings: {
            ...defaultTicketSettings,
            categoryId: context.resources.categories[0].id,
            supportRoleIds: [context.resources.roles[0].id],
            maxPerUser: 10,
            cooldownSeconds: 0,
          },
        },
      })
    ).ok(),
  ).toBeTruthy()
  const panel = newTicketPanel()
  panel.name = 'Transcript ' + randomUUID().slice(0, 6)
  panel.channelId = context.resources.channels[0].id
  const view = await (await request.put(base + '/panels', { headers, data: { panel, revision: 0 } })).json()
  expect(
    (
      await request.post(base + '/panels/' + panel.id + '/publish', {
        headers,
        data: { requestId: randomUUID(), revision: view.revision },
      })
    ).ok(),
  ).toBeTruthy()
  const opened = await (
    await request.post(base + '/open', {
      headers,
      data: {
        panelId: panel.id,
        topicId: panel.topics[0]!.id,
        revision: view.revision,
        answers: { [panel.topics[0]!.questions[0]!.id]: 'Preciso de ajuda' },
      },
    })
  ).json()
  const note = await (
    await request.post(base + '/' + opened.id + '/actions', {
      headers,
      data: { action: 'note', value: 'SECRET STAFF NOTE', revision: opened.revision },
    })
  ).json()
  expect(
    (
      await request.post(base + '/' + opened.id + '/actions', {
        headers,
        data: { action: 'close', value: 'Resolvido', revision: note.revision },
      })
    ).ok(),
  ).toBeTruthy()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`/transcripts/1100000000000000001/${opened.id}`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Minha conta')
  await expect(page.locator('.timeline')).toContainText('Conversa de demonstração.')
  await expect(page.locator('body')).not.toContainText('SECRET STAFF NOTE')
  await page.getByRole('searchbox', { name: 'Buscar na conversa' }).fill('impossível-encontrar')
  await expect(page.getByText('Nenhuma mensagem encontrada.', { exact: true })).toBeVisible()
  await page.getByRole('searchbox').fill('demonstração')
  await expect(page.locator('[data-message]:visible')).toHaveCount(1)
  await page.getByRole('searchbox').fill('')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar HTML', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/ticket-\d+\.html/)
  const htmlPath = testInfo.outputPath('ticket-transcript.html')
  await file.saveAs(htmlPath)
  await page.goto(pathToFileURL(htmlPath).href)
  await page.getByRole('searchbox').fill('impossível-encontrar')
  await expect(page.getByText('Nenhuma mensagem encontrada.', { exact: true })).toBeVisible()
  await page.getByRole('searchbox').fill('')
  const json = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar JSON', exact: true }).click()
  expect((await json).suggestedFilename()).toMatch(/ticket-\d+\.json/)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBeFalsy()
  expect(errors).toEqual([])
})
