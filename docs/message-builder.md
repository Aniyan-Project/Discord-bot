# Criador de mensagens

No dashboard, escolha um servidor e abra **Criador de mensagens**. O acesso exige login Discord e **Gerenciar Servidor**. Alternar entre Clássico e Components V2 preserva o trabalho no outro formato, com prévia ao vivo.

## Formatos

- **Clássico:** mensagem externa, até 10 embeds, título/link/cor, descrição Markdown, autor/link/ícone, miniatura, imagem, até 25 campos por embed com opção inline, rodapé/ícone e timestamp. Campos e embeds podem ser duplicados, removidos e reordenados.
- **Components V2:** containers com cor/spoiler, textos, seções com miniatura ou botão de link, galerias com descrição e spoiler, divisórias/espaçamento e linhas de botões de link. Blocos podem ser duplicados, removidos e reordenados. O JSON avançado edita a mesma mensagem.

O backend valida a estrutura e os limites após resolver variáveis: até 6.000 caracteres agregados nos embeds; até 40 componentes e 4.000 caracteres de texto em V2. O formato V2 usa a flag `32768`, sem combinar `content` ou `embeds`. URLs devem ser HTTPS sem credenciais. Anexos locais, enquetes e componentes interativos com `custom_id` não fazem parte deste criador; use imagens por URL e botões de link.

## Variáveis

Clique em um campo de texto, abra **Variáveis** e escolha um item, ou digite o token manualmente. O backend atualiza os dados do Discord ao enviar. Variáveis desconhecidas impedem o envio.

| Variável          | Valor                                                                    |
| ----------------- | ------------------------------------------------------------------------ |
| `{{server}}`      | Nome do servidor                                                         |
| `{{serverId}}`    | ID do servidor                                                           |
| `{{serverIcon}}`  | URL do ícone; vazio quando não existe                                    |
| `{{memberCount}}` | Contagem de membros informada pelo Discord, aproximada quando disponível |
| `{{channel}}`     | Nome do canal selecionado                                                |
| `{{channelId}}`   | ID do canal selecionado                                                  |
| `{{user}}`        | Nome de exibição de quem envia pelo dashboard                            |
| `{{userId}}`      | ID de quem envia                                                         |
| `{{userMention}}` | Menção de quem envia                                                     |
| `{{userAvatar}}`  | Avatar de quem envia                                                     |
| `{{date}}`        | Data atual                                                               |
| `{{time}}`        | Hora atual                                                               |
| `{{timestamp}}`   | Data e hora ISO 8601; útil no timestamp do embed                         |

Data e hora usam o idioma do servidor e o fuso `America/Sao_Paulo`; o timestamp é UTC. `user` representa o gerente conectado. O criador envia mensagens sob demanda e não configura eventos automáticos de boas-vindas.

## Envio e permissões

1. Escolha um canal de texto ou de anúncios. A lista inclui canais em que você e o bot podem **Ver Canal**, **Enviar Mensagens** e **Inserir Links**. Threads, fóruns e DMs não são destinos deste editor.
2. Selecione **Bot** ou **Webhook**. No segundo modo, personalize nome e avatar HTTPS; ambos aceitam variáveis. Você e o bot precisam de **Gerenciar Webhooks** nesse canal. Essa permissão opcional deve ser concedida manualmente ao bot.
3. O bot cria ou reutiliza um webhook próprio chamado `Branilist Bot · Studio` por canal. Nome/avatar são substituições por mensagem. Tokens de webhook nunca são enviados ao navegador nem incluídos na exportação.
4. Menções vêm desativadas. Ative apenas as categorias desejadas. Notificar cargos ou `@everyone`/`@here` exige **Mencionar @everyone** para a pessoa no canal, além das regras do Discord.
5. Use **Revisar envio**, confira canal/remetente/formato e confirme **Enviar mensagem**. Após sucesso, há um link para a mensagem no Discord.

Um identificador por tentativa e um registro persistente evitam duplicidade em requisições repetidas. Se a entrega ficar incerta, a tentativa não é repetida automaticamente: confira o canal antes de iniciar outra mensagem. Após um envio confirmado, um novo clique de confirmação pode iniciar outro envio. O endpoint limita a seis requisições por minuto por IP, além dos limites do Discord.

## Rascunhos e JSON

**Salvar rascunho** grava um rascunho por pessoa e servidor no SQLite, com revisão para impedir sobrescrita por uma aba antiga. Não envia a mensagem. Alterações não salvas geram aviso ao navegar ou fechar a página. O conteúdo e as URLs do rascunho são persistidos: inclua o banco na política de acesso e backup.

**Importar JSON** aceita um embed isolado, payload clássico ou V2, ou modelo exportado pelo criador. É aceito um único objeto de mensagem por importação, até 256 KB, com validação de estrutura. Conteúdo inválido não substitui o rascunho. Componentes fora dos tipos suportados e campos não editáveis devem ser removidos antes de importar.

**Exportar JSON** oferece:

- **Modelo editável:** conserva variáveis, ambos os formatos e ajustes de envio, para compartilhar e continuar editando.
- **Mensagem do Discord:** resolve variáveis com os dados da prévia e produz o payload nativo do formato ativo. Não inclui credenciais nem cria/envia webhooks. O horário é atualizado quando o envio é feito pelo criador.

No modo demo, salvar funciona apenas no banco em memória e **Simular envio** nunca chama o Discord.

## API interna do dashboard

- `GET /api/guilds/:id/message-studio`: contexto, canais autorizados, rascunho e revisão.
- `PUT /api/guilds/:id/message-studio/draft`: `{ "draft": {}, "revision": 0 }`.
- `POST /api/guilds/:id/message-studio/send`: `{ "draft": {}, "requestId": "UUID" }`.

São endpoints internos autenticados, com verificação de servidor em cada acesso. Mutações exigem `Origin` da aplicação e `X-CSRF-Token`.
