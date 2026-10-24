import { z } from 'zod'
import { t } from '../../../../shared/i18n.js'
import { AppError } from '../../../security.js'
import { mediaDetailComponents, SEARCH_PAGE_SIZE, selectedMediaId } from '../../presentation/media/index.js'
import { defineCommand } from '../types.js'
import { mediaAutocomplete } from './autocomplete.js'
export function createMediaSearchCommand<Id extends 'anime' | 'manga'>(command: Id) {
  return defineCommand(command, {
    aliases: [],
    privateReply: false,
    slashArgs: (i) => [i.options.getString('query', true)],
    configureSlash(command) {
      command.addStringOption((o) =>
        o
          .setName('query')
          .setDescription('Title to search / Título para pesquisar')
          .setRequired(true)
          .setMaxLength(150)
          .setAutocomplete(true),
      )
    },
    optionDescriptions: { query: ['Título para pesquisar', 'Title to search', 'Título para buscar'] },
    autocomplete: mediaAutocomplete(command === 'anime' ? 'ANIME' : 'MANGA'),
    async execute(args, context) {
      const { api, settings, searches, invocation: ctx } = context
      const locale = settings.locale

      const query = z.string().trim().min(1).max(150).parse(args.join(' '))
      const selectedId = ctx.source === 'slash' ? selectedMediaId(query) : undefined
      if (selectedId) {
        const media = await api.mediaDetail(selectedId)
        if (media.type !== (command === 'anime' ? 'ANIME' : 'MANGA')) throw new AppError(404, 'notFound')
        return { componentsV2: mediaDetailComponents(media, settings) }
      }
      const page = await api.search(query, command === 'anime' ? 'ANIME' : 'MANGA', 0, SEARCH_PAGE_SIZE)
      const items = page.nodes
      return items.length === 1 && !page.pageInfo.hasNextPage
        ? { componentsV2: mediaDetailComponents(await api.mediaDetail(items[0]!.id), settings) }
        : items.length || page.pageInfo.hasNextPage
          ? searches.render(items, query, command, ctx, settings, 0, page.pageInfo.hasNextPage)
          : { content: t(locale, 'emptySearch') }
    },
  })
}
