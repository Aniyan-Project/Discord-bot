import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js'
import { commandIds } from '../shared/domain.js'
import { commandDescriptions, t } from '../shared/i18n.js'
const optionDescriptions: Record<string, [string, string, string]> = {
  query: ['Título para pesquisar', 'Title to search', 'Título para buscar'],
  id: ['ID da mídia', 'Media ID', 'ID del contenido'],
  provider: ['Origem do ID', 'ID provider', 'Origen del ID'],
  username: ['Nome de usuário no Branilist', 'Branilist username', 'Nombre de usuario en Branilist'],
  type: ['Tipo de mídia', 'Media type', 'Tipo de contenido'],
  status: ['Status na sua biblioteca', 'Library status', 'Estado en tu biblioteca'],
  page: ['Página da lista', 'List page', 'Página de la lista'],
  media_id: [
    'ID interno da mídia no Branilist',
    'Internal Branilist media ID',
    'ID interno del contenido en Branilist',
  ],
  value: [
    'Episódios ou capítulos concluídos',
    'Episodes or chapters completed',
    'Episodios o capítulos completados',
  ],
  prefix: ['Novo prefixo de comandos', 'New command prefix', 'Nuevo prefijo de comandos'],
  language: [
    'Idioma das respostas neste servidor',
    'Response language in this server',
    'Idioma de las respuestas en este servidor',
  ],
}
const localizedNames: Record<string, [string, string]> = {
  profile: ['perfil', 'perfil'],
  library: ['biblioteca', 'biblioteca'],
  progress: ['progresso', 'progreso'],
  remove: ['remover', 'eliminar'],
  favourites: ['favoritos', 'favoritos'],
  collections: ['colecoes', 'colecciones'],
  connect: ['conectar', 'conectar'],
  disconnect: ['desconectar', 'desconectar'],
  settings: ['config', 'config'],
  help: ['ajuda', 'ayuda'],
  trending: ['alta', 'tendencias'],
}
export function createSlashCommands() {
  return commandIds.map((id) => {
    const command = new SlashCommandBuilder()
      .setName(id)
      .setDescription(t('en', commandDescriptions[id]))
      .setDescriptionLocalizations({
        'pt-BR': t('pt-BR', commandDescriptions[id]),
        'es-ES': t('es', commandDescriptions[id]),
      })
      .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
    const local = localizedNames[id]
    if (local) command.setNameLocalizations({ 'pt-BR': local[0], 'es-ES': local[1] })
    if (id === 'anime' || id === 'manga')
      command.addStringOption((o) =>
        o
          .setName('query')
          .setDescription('Title to search / Título para pesquisar')
          .setRequired(true)
          .setMaxLength(150)
          .setAutocomplete(true),
      )
    if (id === 'media') {
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
    }
    if (id === 'profile')
      command.addStringOption((o) =>
        o.setName('username').setDescription('Branilist username / Nome de usuário').setMaxLength(64),
      )
    if (id === 'trending')
      command.addStringOption((o) =>
        o
          .setName('type')
          .setDescription('Media type / Tipo de mídia')
          .addChoices({ name: 'Anime', value: 'ANIME' }, { name: 'Manga', value: 'MANGA' }),
      )
    if (id === 'library') {
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
    }
    if (id === 'progress') {
      command.addStringOption((o) =>
        o
          .setName('media_id')
          .setDescription('Branilist media ID / ID interno da mídia')
          .setRequired(true)
          .setMaxLength(20),
      )
      command.addIntegerOption((o) =>
        o
          .setName('value')
          .setDescription('Episodes or chapters completed / Episódios ou capítulos concluídos')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(100000),
      )
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
    }
    if (id === 'remove')
      command.addStringOption((o) =>
        o
          .setName('media_id')
          .setDescription('Branilist media ID / ID interno da mídia')
          .setRequired(true)
          .setMaxLength(20),
      )
    if (id === 'settings') {
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
    }
    const json = command.toJSON()
    for (const option of json.options ?? []) {
      const description = optionDescriptions[option.name]
      if (description) {
        option.description = description[1]
        option.description_localizations = { 'pt-BR': description[0], 'es-ES': description[2] }
      }
      if ('choices' in option && option.choices)
        for (const choice of option.choices)
          if (['PLANNING', 'CURRENT', 'COMPLETED', 'PAUSED', 'DROPPED'].includes(String(choice.value))) {
            const status = choice.value as 'PLANNING' | 'CURRENT' | 'COMPLETED' | 'PAUSED' | 'DROPPED'
            choice.name = t('en', status)
            choice.name_localizations = { 'pt-BR': t('pt-BR', status), 'es-ES': t('es', status) }
          }
    }
    return json
  })
}
