import { mediaTitle } from '../../../../shared/domain.js'
import { mediaChoiceValue } from '../../presentation/media/index.js'
import type { AutocompleteContext } from '../types.js'
export const mediaAutocomplete =
  (type: 'ANIME' | 'MANGA') =>
  async (query: string, { api, settings }: AutocompleteContext) => {
    const result = await api.search(query, type)
    return result.nodes.slice(0, 10).map((m) => ({
      name: mediaTitle(m, settings?.titleLanguage ?? 'romaji').slice(0, 100),
      value: mediaChoiceValue(m.id),
    }))
  }
