import { z } from 'zod'
import { t } from '../../../../shared/i18n.js'
import { idSchema, statusSchema } from '../../core/validation.js'
import { defineCommand } from '../types.js'
export default defineCommand('progress', {
  aliases: ['progresso', 'progreso'],
  localizedNames: ['progresso', 'progreso'],
  privateReply: true,
  slashArgs: (i) => [
    i.options.getString('media_id', true),
    String(i.options.getInteger('value', true)),
    i.options.getString('status') || '',
  ],
  configureSlash(command) {
    command.addStringOption((o) =>
      o
        .setName('media_id')
        .setDescription('Branilist media ID / ID interno da mídia')
        .setRequired(true)
        .setMaxLength(20),
    )
    command.addIntegerOption((o) =>
      o
        .setName('value')
        .setDescription('Episodes or chapters completed / Episódios ou capítulos concluídos')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100000),
    )
    command.addStringOption((o) =>
      o
        .setName('status')
        .setDescription('List status / Status na lista')
        .addChoices(
          ...['PLANNING', 'CURRENT', 'COMPLETED', 'PAUSED', 'DROPPED'].map((value) => ({
            name: value,
            value,
          })),
        ),
    )
  },
  optionDescriptions: {
    media_id: [
      'ID interno da mídia no Branilist',
      'Internal Branilist media ID',
      'ID interno del contenido en Branilist',
    ],
    value: [
      'Episódios ou capítulos concluídos',
      'Episodes or chapters completed',
      'Episodios o capítulos completados',
    ],
    status: ['Status na sua biblioteca', 'Library status', 'Estado en tu biblioteca'],
  },
  async execute(args, context) {
    const { settings, api, invocation: ctx } = context
    const locale = settings.locale

    const mediaId = idSchema.parse(args[0])
    const progress = z.coerce.number().int().min(0).max(100000).parse(args[1])
    const status = args[2] ? statusSchema.parse(args[2].toUpperCase()) : undefined
    await api.progress(ctx.userId, mediaId, progress, status)
    return { private: true, content: t(locale, 'progressSaved') }
  },
})
