import { t } from '../../../../shared/i18n.js'
import { defineCommand } from '../types.js'
export default defineCommand('connect', {
  aliases: ['conectar', 'vincular'],
  localizedNames: ['conectar', 'conectar'],
  privateReply: true,
  async execute(args, context) {
    const { settings, config } = context
    const locale = settings.locale

    return {
      private: true,
      content: t(locale, 'accountBody'),
      link: {
        label: t(locale, 'linkAccount'),
        url: `${config.APP_URL}/dashboard/account?lang=${locale}`,
      },
    }
  },
})
