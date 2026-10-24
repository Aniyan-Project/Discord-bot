import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { ticketId, discordId } from '../../shared/tickets.js'
import type { TicketService } from '../bot/tickets/service.js'
import type { Session } from '../store.js'
import { renderTranscript } from './transcript.js'
import { transcriptPath } from './links.js'
import { AppError } from '../security.js'
export function registerTicketRoutes(
  app: FastifyInstance,
  service: TicketService,
  auth: (r: FastifyRequest) => Session,
  csrf: (r: FastifyRequest) => Session,
) {
  app.get('/transcripts/:id/:ticketId', async (r, reply) => {
    reply.header('cache-control', 'no-store').header('x-robots-tag', 'noindex, nofollow')
    const p = z.object({ id: discordId, ticketId }).parse(r.params)
    let actor: Session
    try {
      actor = auth(r)
    } catch (error) {
      if (error instanceof AppError && error.status === 401)
        return reply.redirect(
          '/auth/discord?returnTo=' + encodeURIComponent(transcriptPath(p.id, p.ticketId)),
        )
      throw error
    }
    const rendered = renderTranscript(await service.transcriptDocument(p.id, actor.user.id, p.ticketId))
    return reply
      .header('content-security-policy', rendered.csp)
      .type('text/html; charset=utf-8')
      .send(rendered.html)
  })
  app.post('/api/guilds/:id/tickets/panels/:ticketId/reconcile', async (r) => {
    const actor = csrf(r),
      p = z.object({ id: discordId, ticketId }).parse(r.params),
      b = z
        .object({ messageId: z.union([discordId, z.null()]), confirmed: z.literal(true) })
        .strict()
        .parse(r.body)
    return service.reconcilePanel(p.id, actor.user.id, p.ticketId, b.messageId)
  })
  const scope = (r: FastifyRequest, write = false) => {
    const actor = write ? csrf(r) : auth(r)
    return { user: actor.user.id, guild: discordId.parse((r.params as { id: string }).id) }
  }
  const params = (r: FastifyRequest) => ticketId.parse((r.params as { ticketId: string }).ticketId)
  app.get('/api/guilds/:id/tickets/context', async (r) => {
    const { guild, user } = scope(r)
    return service.context(guild, user)
  })
  app.put('/api/guilds/:id/tickets/settings', async (r) => {
    const { guild, user } = scope(r, true)
    const b = z
      .object({ settings: z.unknown(), revision: z.number().int().min(0) })
      .strict()
      .parse(r.body)
    return service.saveSettings(guild, user, b.settings, b.revision)
  })
  app.put('/api/guilds/:id/tickets/panels', { bodyLimit: 131072 }, async (r) => {
    const { guild, user } = scope(r, true)
    const b = z
      .object({ panel: z.unknown(), revision: z.number().int().min(0) })
      .strict()
      .parse(r.body)
    return service.savePanel(guild, user, b.panel, b.revision)
  })
  app.delete('/api/guilds/:id/tickets/panels/:ticketId', async (r) => {
    const { guild, user } = scope(r, true)
    return service.deletePanel(guild, user, params(r))
  })
  app.post(
    '/api/guilds/:id/tickets/panels/:ticketId/publish',
    { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } },
    async (r) => {
      const { guild, user } = scope(r, true)
      const b = z
        .object({ requestId: z.uuid(), revision: z.number().int().min(1) })
        .strict()
        .parse(r.body)
      return service.publish(guild, user, params(r), b.requestId, b.revision)
    },
  )
  app.post('/api/guilds/:id/tickets/templates', { bodyLimit: 131072 }, async (r) => {
    const { guild, user } = scope(r, true)
    return service.template(guild, user, r.body)
  })
  app.delete('/api/guilds/:id/tickets/templates/:ticketId', async (r) => {
    const { guild, user } = scope(r, true)
    return service.deleteTemplate(guild, user, params(r))
  })
  app.get('/api/guilds/:id/tickets', async (r) => {
    const { guild, user } = scope(r)
    const q = z.object({ offset: z.coerce.number().int().min(0).max(100000).default(0) }).parse(r.query)
    return service.list(guild, user, q.offset)
  })
  app.get('/api/guilds/:id/tickets/:ticketId', async (r) => {
    const { guild, user } = scope(r)
    return service.detail(guild, user, params(r))
  })
  app.get('/api/guilds/:id/tickets/:ticketId/transcript', async (r, reply) => {
    const { guild, user } = scope(r)
    const id = params(r)
    return reply
      .header('content-disposition', `attachment; filename="ticket-${id}.json"`)
      .send(await service.transcript(guild, user, id))
  })
  for (const format of ['view', 'html'] as const) {
    app.get(`/api/guilds/:id/tickets/:ticketId/transcript/${format}`, async (r, reply) => {
      const { guild, user } = scope(r),
        id = params(r)
      const rendered = renderTranscript(await service.transcriptDocument(guild, user, id))
      reply.header('content-security-policy', rendered.csp)
      if (format === 'html') reply.header('content-disposition', `attachment; filename="ticket-${id}.html"`)
      return reply.type('text/html; charset=utf-8').send(rendered.html)
    })
  }
  app.post(
    '/api/guilds/:id/tickets/:ticketId/actions',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (r) => {
      const { guild, user } = scope(r, true)
      const b = z
        .object({
          action: z.enum(['claim', 'transfer', 'close', 'reopen', 'note', 'recover']),
          value: z.string().max(2000).default(''),
          revision: z.number().int().min(1),
        })
        .strict()
        .parse(r.body)
      return service.action(guild, user, params(r), b.action, b.value, b.revision)
    },
  )
  app.post(
    '/api/guilds/:id/tickets/open',
    { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } },
    async (r) => {
      const { guild, user } = scope(r, true)
      await service.manage(guild, user)
      const b = z
        .object({
          panelId: ticketId,
          topicId: ticketId,
          answers: z.record(ticketId, z.string().max(2000)),
          revision: z.number().int().min(1),
        })
        .strict()
        .parse(r.body)
      return service.open(guild, user, b.panelId, b.topicId, b.answers, b.revision)
    },
  )
}
