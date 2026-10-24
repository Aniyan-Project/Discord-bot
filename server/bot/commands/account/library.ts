import { escapeMarkdown } from 'discord.js'
import { z } from 'zod'
import { mediaTitle } from '../../../../shared/domain.js'
import { t } from '../../../../shared/i18n.js'
import { statusSchema } from '../../core/validation.js'
import { embed } from '../../presentation/embeds.js'
import { defineCommand } from '../types.js'
export default defineCommand('library', {
  aliases: ['biblioteca', 'lista'],
  localizedNames: ['biblioteca', 'biblioteca'],
  privateReply: true,
  slashArgs: (i) => [i.options.getString('status') || '', String(i.options.getInteger('page') || 1)],
  configureSlash(command) {
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
    command.addIntegerOption((o) =>
      o.setName('page').setDescription('Page / Página').setMinValue(1).setMaxValue(834),
    )
  },
  optionDescriptions: {
    status: ['Status na sua biblioteca', 'Library status', 'Estado en tu biblioteca'],
    page: ['Página da lista', 'List page', 'Página de la lista'],
  },
  async execute(args, context) {
    const { api, settings, invocation: ctx } = context
    const locale = settings.locale

    const status = args[0] ? statusSchema.parse(args[0].toUpperCase()) : undefined
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(834)
      .parse(args[1] || 1)
    const list = await api.library(ctx.userId, (page - 1) * 12, status)
    return {
      private: true,
      embeds: [
        embed(
          settings,
          t(locale, 'library'),
          list.nodes.length
            ? list.nodes
                .map(
                  (e) =>
                    `**${escapeMarkdown(e.media ? mediaTitle(e.media, settings.titleLanguage) : e.mediaId)}**\n${t(locale, e.status)} · ${t(locale, 'progress')}: ${e.progress} · ID ${e.mediaId}`,
                )
                .join('\n\n')
            : t(locale, 'emptyLibrary'),
        ),
      ],
      ...(list.pageInfo.hasNextPage
        ? { content: `${t(locale, 'next')}: /library ${status || ''} ${page + 1}` }
        : {}),
    }
  },
})
