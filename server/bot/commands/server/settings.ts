import { InteractionContextType, PermissionFlagsBits } from 'discord.js'
import { z } from 'zod'
import { guildSettingsSchema } from '../../../../shared/domain.js'
import { t } from '../../../../shared/i18n.js'
import { AppError } from '../../../security.js'
import { defineCommand } from '../types.js'
export default defineCommand('settings', {
  aliases: ['config'],
  localizedNames: ['config', 'config'],
  privateReply: true,
  slashArgs: (i) => [
    ...(i.options.getString('prefix') ? ['prefix', i.options.getString('prefix')!] : []),
    ...(i.options.getString('language') ? ['language', i.options.getString('language')!] : []),
  ],
  configureSlash(command) {
    command
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setContexts(InteractionContextType.Guild)
    command.addStringOption((o) =>
      o.setName('prefix').setDescription('New command prefix / Novo prefixo').setMaxLength(8),
    )
    command.addStringOption((o) =>
      o
        .setName('language')
        .setDescription('Server language / Idioma do servidor')
        .addChoices(
          { name: 'Português', value: 'pt-BR' },
          { name: 'English', value: 'en' },
          { name: 'Español', value: 'es' },
        ),
    )
  },
  optionDescriptions: {
    prefix: ['Novo prefixo de comandos', 'New command prefix', 'Nuevo prefijo de comandos'],
    language: [
      'Idioma das respostas neste servidor',
      'Response language in this server',
      'Idioma de las respuestas en este servidor',
    ],
  },
  async execute(args, context) {
    const { config, store, settings, invocation: ctx } = context
    const locale = settings.locale

    if (!ctx.guildId || !ctx.manageGuild) throw new AppError(403, 'forbidden')
    const updated = await store.withGuildLock(ctx.guildId, async () => {
      const before = store.settings(ctx.guildId!)
      const updated = { ...before.settings }
      for (let i = 0; i < args.length; i += 2) {
        if (args[i] === 'prefix') updated.prefix = args[i + 1] ?? ''
        else if (args[i] === 'locale' || args[i] === 'language')
          updated.locale = z.enum(['pt-BR', 'en', 'es']).parse(args[i + 1])
        else throw new AppError(400, 'invalidInput')
      }
      if (args.length)
        store.saveSettings(ctx.guildId!, guildSettingsSchema.parse(updated), before.revision, ctx.userId)
      return updated
    })
    return {
      private: true,
      content: `${t(updated.locale, 'prefix')}: ${updated.prefix}\n${t(updated.locale, 'language')}: ${updated.locale}`,
      link: {
        label: t(locale, 'configuration'),
        url: `${config.APP_URL}/dashboard/${ctx.guildId}/settings`,
      },
    }
  },
})
