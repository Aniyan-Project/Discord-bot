import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { t } from '../../../shared/i18n.js'
import { commands } from '../commands/registry.js'
export function createSlashCommands() {
  return commands.map((definition) => {
    const builder = new SlashCommandBuilder()
      .setName(definition.id)
      .setDescription(t('en', definition.description))
      .setDescriptionLocalizations({
        'pt-BR': t('pt-BR', definition.description),
        'es-ES': t('es', definition.description),
      })
      .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
    if (definition.localizedNames)
      builder.setNameLocalizations({
        'pt-BR': definition.localizedNames[0],
        'es-ES': definition.localizedNames[1],
      })
    definition.configureSlash?.(builder)
    const json = builder.toJSON()
    for (const option of json.options ?? []) {
      const description = definition.optionDescriptions?.[option.name]
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
