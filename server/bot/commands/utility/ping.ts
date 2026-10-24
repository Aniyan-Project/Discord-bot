import { defineCommand } from '../types.js'
export default defineCommand('ping', {
  aliases: [],
  privateReply: false,
  async execute(args, context) {
    const {} = context

    return { content: 'Pong! 🏓' }
  },
})
