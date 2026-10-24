# Organização e extensão do bot

O código específico do Discord fica em `server/bot/`. Os comandos por prefixo e slash usam os mesmos módulos e o mesmo motor de execução. As definições de slash, os aliases, a privacidade da resposta e o autocomplete vêm do registro de comandos; não há um `switch` central por nome.

```text
server/bot/
  runtime.ts                  # Composição do cliente, início e encerramento
  commands/
    registry.ts               # Registro tipado dos comandos e seus aliases
    types.ts                  # Contrato CommandDefinition e defineCommand
    catalog/                  # anime, manga, media, trending
    account/                  # profile, library, progress, remove, favourites...
    server/                   # settings
    utility/                  # help, ping
  core/
    engine.ts                 # Despacho, contexto e histórico de execução
    policy.ts                 # Cooldown, modos, comandos/canais permitidos
    types.ts                  # Invocation, CommandContext e CommandResult
    context.ts                # Dependências dos eventos e handlers
    cooldowns.ts              # Controle compartilhado de frequência
    validation.ts             # Schemas reutilizados pelos comandos
  events/                     # Registros dos eventos do gateway
    index.ts                  # Lista explícita e remoção dos listeners
    interaction-create.ts     # Encaminha interações para os handlers
    message-create.ts         # Adapta mensagens de prefixo
    error.ts                  # Erros de conexão
  handlers/                   # Slash, autocomplete, busca e confirmação
    index.ts                  # Roteamento pela primeira correspondência
    types.ts                  # Contrato InteractionHandler
  interactions/               # Estado temporário das buscas e confirmações
  presentation/
    embeds.ts                 # Embeds clássicos e texto do catálogo
    payload.ts                # Resposta Discord e menções desativadas
    errors.ts                 # Mensagens localizadas de erro
    media/                    # Detalhe, pesquisa, metadados e IDs de seleção
  parsing/prefix.ts           # Tokenização, prefixo e aliases do registro
  registration/
    slash-commands.ts         # Serialização/localização das definições slash
  services/message-studio.ts  # Contexto e envio do criador de mensagens
```

`server/register.ts` continua sendo a entrada de `npm run commands:register`. `server/app.ts` compõe a API e o runtime. Configuração, segurança, SQLite e o serviço Branilist permanecem em `server/`, pois também atendem ao dashboard. Contratos e traduções usados no navegador ficam em `shared/`.

## Adicionar um comando

1. Acrescente o ID a `commandIds`, em `shared/domain.ts`. O tipo `CommandId` e a validação de comandos desativados acompanham essa lista.
2. Em `shared/i18n.ts`, acrescente os textos em Português, Inglês e Espanhol e associe o ID em `commandDescriptions`. Esse contrato também atende ao dashboard e à ajuda.
3. Crie o módulo na categoria apropriada em `commands/` usando `defineCommand`. Coloque nele execução, aliases, nomes localizados, opções, leitura dos argumentos e privacidade. Os comandos `anime` e `manga` usam uma fábrica comum em `catalog/search.ts` para compartilhar o mesmo fluxo de busca.
4. Importe o módulo e adicione a propriedade correspondente em `commands/registry.ts`. O registro é exaustivo e tipado: esquecer um comando ou associar o módulo ao ID errado falha na compilação. Aliases repetidos ou iguais a nomes de comandos são rejeitados na inicialização.
5. Teste prefixo e slash, validação, permissões, privacidade e tradução. Se a definição slash mudou, execute `npm run commands:register` no ambiente autorizado. Uma reorganização sem mudança nas definições não exige novo registro no Discord.

Exemplo de módulo, **depois de adicionar `hello`, `helloCommand` e `helloReply` aos contratos e traduções**:

```ts
import { t } from '../../../../shared/i18n.js'
import { defineCommand } from '../types.js'

export default defineCommand('hello', {
  aliases: ['ola', 'hola'],
  localizedNames: ['ola', 'hola'],
  privateReply: false,
  async execute(_args, { settings }) {
    return { content: t(settings.locale, 'helloReply') }
  },
})
```

`execute` recebe `CommandContext`, com a invocação, configurações, API Branilist, banco, configuração do processo e serviços de interação. Use schemas para validar argumentos. Deixe cooldown, política de canais, modos habilitados e histórico no núcleo, para que prefixo e slash se comportem igualmente.

Para opções slash, use `configureSlash(builder)` e `optionDescriptions` com os três idiomas. `slashArgs(interaction)` converte as opções nos argumentos esperados por `execute`. Sem essa função, o comando recebe uma lista vazia. `privateReply` pode ser um booleano ou uma função, como no perfil que distingue consulta própria de consulta pública; o handler usa essa informação antes de adiar a resposta. Respostas pessoais por prefixo devem retornar `private: true`.

O hook opcional `autocomplete(query, context)` retorna sugestões. O handler compartilhado aplica as regras do servidor, a frequência e o prazo de resposta. Comandos novos com autocomplete não exigem uma condição nova no handler.

Para uma confirmação, o comando chama `confirmations.create(invocation, id, { prompt, success, execute })`: as chaves localizadas e a operação ficam no módulo do recurso. O serviço de sessões cuida do dono, prazo, cancelamento, consumo único e revalidação da política. Não acrescente ramificações por nome de comando nesse serviço.

## Adicionar um evento

Crie um módulo em `events/` implementando `BotEventModule`: um nome de evento e uma função `register(context)` que registra seu listener e devolve a função para removê-lo. Adicione o módulo a `botEvents`, em `events/index.ts`.

O runtime registra os eventos na construção e remove seus listeners ao encerrar. Não espalhe chamadas a `client.on` no construtor do runtime ou nos módulos de comandos.

## Adicionar botões, seletores ou outros handlers

Crie uma fábrica em `handlers/` que receba `BotContext` e retorne `InteractionHandler` com `name`, `matches` e `handle`. Registre-a em `handlers/index.ts`, na ordem desejada. O primeiro handler correspondente recebe a interação; use nomes/prefixos específicos de `customId` para evitar sobreposição.

Mantenha o reconhecimento e a resposta Discord no handler. Coloque estados e operações de confirmação/paginação em `interactions/`, associados ao dono e ao contexto original, com expiração e proteção contra execução concorrente. Nunca guarde sessões de pessoas em um singleton global compartilhado entre runtimes.

## Apresentação e serviços

Formatação deve retornar `CommandResult` ou componentes pela camada `presentation/`. O evento adapta isso a uma resposta Discord; o módulo de comando não deve enviar diretamente por `client`.

Serviços específicos do Discord, como envio por webhook, ficam em `services/`. Operações Branilist usam o SDK através do serviço compartilhado, preservando autorização, escopos e renovação dos tokens.

## Verificação

Execute `npm run check`, `npm run test:production` e `npm run test:ui`. Os testes de `bot-dispatch.test.ts` verificam o registro dos comandos, argumentos slash, privacidade, encaminhamento de aliases, autocomplete extensível, isolamento entre runtimes e remoção de listeners. Os demais testes cobrem as regras, sessões e operações existentes. Não use tokens reais nem envie mensagens externas nos testes.
