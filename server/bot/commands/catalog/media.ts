import { z } from 'zod'
import { idSchema } from '../../core/validation.js'
import { mediaEmbed } from '../../presentation/embeds.js'
import { defineCommand } from '../types.js'
export default defineCommand('media', {
  aliases: [],
  privateReply: false,
  slashArgs: (i) => [i.options.getString('id', true), i.options.getString('provider') || 'branilist'],
  configureSlash(command) {
    command.addStringOption((o) =>
      o.setName('id').setDescription('Media ID / ID da mídia').setRequired(true).setMaxLength(20),
    )
    command.addStringOption((o) =>
      o
        .setName('provider')
        .setDescription('ID provider / Origem do ID')
        .addChoices(
          { name: 'Branilist', value: 'branilist' },
          { name: 'MyAnimeList', value: 'mal' },
          { name: 'AniList', value: 'anilist' },
        ),
    )
  },
  optionDescriptions: {
    id: ['ID da mídia', 'Media ID', 'ID del contenido'],
    provider: ['Origem do ID', 'ID provider', 'Origen del ID'],
  },
  async execute(args, context) {
    const { api, settings } = context

    const id = idSchema.parse(args[0])
    const provider = z.enum(['branilist', 'mal', 'anilist']).parse(args[1] || 'branilist')
    return { embeds: [mediaEmbed(await api.media(id, provider), settings)] }
  },
})
