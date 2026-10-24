import { z } from 'zod'
import { t } from '../../../../shared/i18n.js'
import { mediaList } from '../../presentation/embeds.js'
import { defineCommand } from '../types.js'
export default defineCommand('trending', {
  aliases: ['tendencias', 'alta'],
  localizedNames: ['alta', 'tendencias'],
  privateReply: false,
  slashArgs: (i) => [i.options.getString('type') || 'ANIME'],
  configureSlash(command) {
    command.addStringOption((o) =>
      o
        .setName('type')
        .setDescription('Media type / Tipo de mídia')
        .addChoices({ name: 'Anime', value: 'ANIME' }, { name: 'Manga', value: 'MANGA' }),
    )
  },
  optionDescriptions: { type: ['Tipo de mídia', 'Media type', 'Tipo de contenido'] },
  async execute(args, context) {
    const { api, settings } = context
    const locale = settings.locale

    const type = z.enum(['ANIME', 'MANGA']).parse((args[0] || 'ANIME').toUpperCase())
    return mediaList(await api.trending(type), settings, t(locale, 'trending'))
  },
})
