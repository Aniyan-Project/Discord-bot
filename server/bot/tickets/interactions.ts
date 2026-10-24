import {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  AttachmentBuilder,
  type Interaction,
} from 'discord.js'
import type { TicketService } from './service.js'
import { AppError } from '../../security.js'
import { tt } from '../../../shared/ticket-i18n.js'
import type { InteractionHandler } from '../handlers/types.js'
import { openingForm, formAnswers } from './forms.js'
import { renderTranscript } from '../../tickets/transcript.js'
import { ticketControls } from './messages.js'
const messages: Record<string, string> = {
  invalidInput: 'Revise a resposta e os limites deste campo.',
  ticketLimit: 'Limite de tickets atingido. Aguarde um atendimento ser encerrado.',
  ticketCooldown: 'Aguarde antes de abrir outro atendimento.',
  ticketUncertain:
    'Não foi possível confirmar a operação no Discord. Verifique o canal antes de tentar novamente.',
  ticketTranscriptExpired: 'Transcrição indisponível ou expirada.',
  ticketNotConfigured: 'Configure categoria, equipe e canal antes de publicar.',
}
export function ticketInteractionHandler(service: TicketService): InteractionHandler {
  return {
    name: 'tickets',
    matches: (i) =>
      'customId' in i &&
      typeof i.customId === 'string' &&
      i.customId.startsWith('ticket:') &&
      (i.isButton() || i.isStringSelectMenu() || i.isModalSubmit()),
    async handle(i: Interaction) {
      if (!i.isButton() && !i.isStringSelectMenu() && !i.isModalSubmit()) return
      if (!i.guildId) return
      const guild = i.guildId,
        user = i.user.id,
        locale = service.repo.settings(guild).settings.locale,
        tr = (s: string) => tt(locale, s)
      try {
        const [, action, id, extra, revision] = i.customId.split(':')
        if (!id) throw new AppError(400, 'invalidInput')
        if (action === 'open' && (i.isButton() || i.isStringSelectMenu())) {
          const topicId = i.isStringSelectMenu() ? i.values[0] : extra
          if (!topicId) throw new AppError(400, 'invalidInput')
          const view = service.repo.panel(guild, id, true)
          if (view?.messageId !== i.message.id) throw new AppError(404, 'notFound')
          const { topic, revision } = service.opening(guild, id, topicId)
          if (!topic.questions.length) {
            await i.deferReply({ flags: MessageFlags.Ephemeral })
            const t = await service.open(guild, user, id, topicId, {}, revision)
            await i.editReply({ content: `${tr('Seu atendimento foi criado.')} <#${t.channelId}>` })
            return
          }
          const modal = openingForm(`ticket:form:${id}:${topic.id}:${revision}`, topic)
          await i.showModal(modal)
          return
        }
        if (action === 'close' && i.isButton()) {
          const modal = new ModalBuilder()
            .setCustomId(`ticket:reason:${id}`)
            .setTitle(tr('Encerrar ticket'))
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('reason')
                  .setLabel(tr('Motivo do encerramento'))
                  .setStyle(TextInputStyle.Paragraph)
                  .setMaxLength(1000)
                  .setRequired(true),
              ),
            )
          await i.showModal(modal)
          return
        }
        await i.deferReply({ flags: MessageFlags.Ephemeral })
        if (action === 'form' && i.isModalSubmit()) {
          if (!extra) throw new AppError(400, 'invalidInput')
          const { topic } = service.opening(guild, id, extra)
          const answers = formAnswers(topic, i.fields)
          const t = await service.open(guild, user, id, extra, answers, Number(revision))
          await i.editReply({ content: `${tr('Seu atendimento foi criado.')} <#${t.channelId}>` })
          return
        }
        if (action === 'claim' && i.isButton()) {
          const already = service.repo.get(guild, id)?.staffId === user
          const record = await service.action(guild, user, id, 'claim')
          await i.message.edit({ components: [ticketControls(record)] }).catch(() => {})
          await i.editReply({
            content: tr(already ? 'Você já é responsável por este ticket.' : 'Ação concluída.'),
          })
          return
        } else if (action === 'reason' && i.isModalSubmit()) {
          try {
            await service.detail(guild, user, id)
          } catch (e) {
            const t = service.repo.get(guild, id)
            if (e instanceof AppError && e.status === 403 && t?.authorId === user) {
              await service.requestClose(guild, user, id)
              await i.editReply({ content: tr('Solicitar encerramento') })
              return
            }
            throw e
          }
          await service.action(guild, user, id, 'close', i.fields.getTextInputValue('reason'))
        } else if (action === 'transcript') {
          const data = await service.transcriptDocument(guild, user, id)
          const file = Buffer.from(renderTranscript(data).html)
          if (file.length > i.attachmentSizeLimit) {
            await i.editReply({
              content: `${tr('Abra o visualizador autenticado para esta transcrição.')} ${service.discord.appUrl}/api/guilds/${guild}/tickets/${id}/transcript/view`,
            })
            return
          }
          await i.editReply({
            files: [
              new AttachmentBuilder(file, {
                name: `ticket-${data.ticket.number}.html`,
              }),
            ],
          })
          return
        } else throw new AppError(400, 'invalidInput')
        await i.editReply({ content: tr('Ação concluída.') })
      } catch (error) {
        const code = error instanceof AppError ? error.code : ''
        const content = tr(messages[code] ?? 'Este atendimento não está disponível ou você não tem acesso.')
        if (i.deferred || i.replied) await i.editReply({ content }).catch(() => {})
        else await i.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {})
      }
    },
  }
}
