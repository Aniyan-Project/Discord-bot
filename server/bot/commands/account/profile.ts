import { escapeMarkdown } from 'discord.js'
import { z } from 'zod'
import { safeImage } from '../../../../shared/domain.js'
import { cleanText, embed } from '../../presentation/embeds.js'
import { defineCommand } from '../types.js'
export default defineCommand('profile', {
  aliases: ['perfil'],
  localizedNames: ['perfil', 'perfil'],
  privateReply: (i) => !i.options.getString('username'),
  slashArgs: (i) => (i.options.getString('username') ? [i.options.getString('username')!] : []),
  configureSlash(command) {
    command.addStringOption((o) =>
      o.setName('username').setDescription('Branilist username / Nome de usuário').setMaxLength(64),
    )
  },
  optionDescriptions: {
    username: ['Nome de usuário no Branilist', 'Branilist username', 'Nombre de usuario en Branilist'],
  },
  async execute(args, context) {
    const { api, settings, invocation: ctx } = context

    const username = args[0] ? z.string().min(1).max(64).parse(args[0]) : undefined
    const profile = await api.profile(ctx.userId, username)
    return {
      private: !username,
      embeds: [
        {
          ...embed(settings, profile.displayName, escapeMarkdown(cleanText(profile.bio || '—', 600))),
          url: `https://branilist.com/user/${encodeURIComponent(profile.username)}`,
          ...(safeImage(profile.avatarUrl) ? { thumbnail: { url: safeImage(profile.avatarUrl)! } } : {}),
          fields: [
            { name: 'Username', value: escapeMarkdown(profile.username), inline: true },
            { name: 'ID', value: profile.id, inline: true },
          ],
        },
      ],
    }
  },
})
