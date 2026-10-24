import { t } from '../../../../shared/i18n.js'
import { mediaList } from '../../presentation/embeds.js'
import { defineCommand } from '../types.js'
export default defineCommand('favourites', {
  aliases: ['favoritos', 'favorites'],
  localizedNames: ['favoritos', 'favoritos'],
  privateReply: true,
  async execute(args, context) {
    const { api, settings, invocation: ctx } = context
    const locale = settings.locale

    return {
      ...mediaList(await api.favourites(ctx.userId), settings, t(locale, 'favourites')),
      private: true,
    }
  },
})
