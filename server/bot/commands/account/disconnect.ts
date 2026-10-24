import { defineCommand } from '../types.js'
export default defineCommand('disconnect', {
  aliases: ['desconectar', 'desvincular'],
  localizedNames: ['desconectar', 'desconectar'],
  privateReply: true,
  async execute(args, context) {
    const { api, confirmations, invocation: ctx } = context
    const userId = ctx.userId

    return confirmations.create(ctx, 'disconnect', {
      prompt: 'unlinkConfirm',
      success: 'notLinked',
      execute: () => api.unlink(userId),
    })
  },
})
