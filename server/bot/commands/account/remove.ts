import { AppError } from '../../../security.js'
import { idSchema } from '../../core/validation.js'
import { defineCommand } from '../types.js'
export default defineCommand('remove', {
  aliases: ['remover', 'eliminar'],
  localizedNames: ['remover', 'eliminar'],
  privateReply: true,
  slashArgs: (i) => [i.options.getString('media_id', true)],
  configureSlash(command) {
    command.addStringOption((o) =>
      o
        .setName('media_id')
        .setDescription('Branilist media ID / ID interno da mídia')
        .setRequired(true)
        .setMaxLength(20),
    )
  },
  optionDescriptions: {
    media_id: [
      'ID interno da mídia no Branilist',
      'Internal Branilist media ID',
      'ID interno del contenido en Branilist',
    ],
  },
  async execute(args, context) {
    const { config, store, api, confirmations, invocation: ctx } = context

    if (!config.DEMO_MODE && !store.account(ctx.userId)) throw new AppError(401, 'linkRequired')
    const mediaId = idSchema.parse(args[0])
    const userId = ctx.userId
    return confirmations.create(ctx, 'remove', {
      prompt: 'confirmRemove',
      success: 'removed',
      execute: () => api.remove(userId, mediaId),
    })
  },
})
