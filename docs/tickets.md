# Tickets

O módulo de tickets tem uma seção própria no dashboard: visão geral, painéis de abertura, modelos, histórico, configurações e permissões/auditoria. As telas e mensagens automáticas têm Português, Inglês e Espanhol. O conteúdo escrito pelo gestor não é traduzido automaticamente.

## Configuração inicial

1. Entre no dashboard com uma conta que tenha **Gerenciar servidor**. Selecione o servidor e abra **Tickets → Configurações**.
2. Escolha uma categoria, os cargos de suporte e, se necessário, os cargos que podem gerir os atendimentos pelo Discord. Você pode sobrescrever categoria e equipe por assunto.
   Os cargos também podem ser editados em **Tickets → Permissões e auditoria**: busque pelo nome, marque os cargos desejados e clique em **Salvar cargos**. Cada caixa aceita vários cargos; desmarque para remover e salve novamente.
3. Se usar registros, escolha um **canal privado da equipe**. `@everyone` e cargos que não são de suporte/gestão não podem enxergá-lo, exceto permissões administrativas inerentes. Os registros são embeds com autor, assunto, nome do canal, responsável e horários. No encerramento, mostram também quem encerrou, a duração e o motivo. Não incluem respostas do formulário, notas internas ou a conversa.
4. Crie um painel, personalize clássico/Components V2, configure até cinco assuntos e até cinco campos por assunto. No formulário, escolha o tipo em **Novo campo** e clique em **Adicionar campo**. Campos existentes também podem trocar de tipo.
5. Salve o rascunho. Revise canal e formato antes de publicar. Testar um painel publicado cria um atendimento real; o dashboard pede a confirmação e as respostas. Em `DEMO_MODE`, todos os efeitos do Discord são simulados.

O bot precisa de Ver canais, Enviar mensagens, Inserir links, Anexar arquivos, Ler histórico, Gerenciar canais e, para threads, Criar threads privadas, Enviar mensagens em threads e Gerenciar threads. O link de convite inclui essas permissões, sem solicitar Administrador. Para um bot já instalado, revise os cargos e as permissões de canal. O gestor também precisa conseguir ver o canal do painel e enviar mensagens nele.

## Campos do formulário

- **Texto curto ou longo:** exemplo de preenchimento, texto de ajuda e mínimo/máximo de caracteres (até 2.000).
- **Seleção única:** menu com uma opção por resposta.
- **Seleção múltipla:** menu com várias escolhas e limites de seleção.
- **Botões de opção:** alternativas visíveis para uma única escolha (mínimo de duas opções).
- **Caixas de seleção:** grupo de alternativas com mínimo/máximo de escolhas.
- **Confirmação:** caixa individual de sim/não. Se obrigatória, o Discord exige a marcação antes de enviar.

Defina até dez opções distintas por campo de escolha, uma por linha, com até 100 caracteres por opção. Todos os campos permitem texto de ajuda e podem ser obrigatórios ou opcionais. Os controles de ordenação movem os campos; a prévia permite experimentar os tipos. O limite total continua sendo cinco campos por formulário. Os tipos usam componentes nativos de modal do Discord, tanto em painéis clássicos quanto V2.

Salve o rascunho e **republique o painel** para aplicar mudanças ao formulário no Discord. Publicações existentes continuam usando o formulário publicado anteriormente. Formulários antigos de texto seguem funcionando. Respostas são validadas no servidor antes da criação: opções inexistentes ou duplicadas, limites de seleção e confirmações obrigatórias são rejeitados. Seleções múltiplas são persistidas como arrays JSON dentro do valor da resposta e exibidas de forma legível no histórico e no ticket.

## Atendimento

O membro escolhe um assunto pelo menu ou botão e preenche o formulário. O bot cria um canal privado com acesso explícito para o autor, a equipe configurada, os gestores e o próprio bot. Os botões permitem assumir, solicitar/realizar o encerramento e obter transcrições conforme as permissões. Um autor sem cargo de equipe solicita o encerramento; ele não encerra o atendimento diretamente.

No histórico do dashboard, gestores podem assumir, transferir para um membro autorizado, adicionar notas internas, encerrar, reabrir e baixar transcrições. Cargos de suporte/gestão delegados são verificados em cada ação do Discord e na API; a seleção de servidores do dashboard mantém a exigência existente de Gerenciar servidor. Revogar um cargo revoga as ações correspondentes. Administradores do Discord continuam tendo os acessos inerentes à plataforma.

O modo restrito ao assumir remove o acesso dos outros cargos de suporte no canal. Na transferência de uma thread restrita, o responsável anterior é removido. Gestores mantêm suas permissões. O bot não atribui cargos a usuários.

Assumir um ticket já atribuído ao mesmo responsável é uma operação idempotente: não repete avisos, menções, alterações de acesso nem auditoria. A autorização é revalidada mesmo nesses cliques. Novos controles mostram **Ticket assumido**; botões antigos continuam protegidos no servidor.

### Threads privadas

Threads precisam de um canal pai acessível ao autor e de um canal privado de registros para a equipe receber os controles de atendimento. Em threads, cargos não concedem participação automaticamente: o responsável entra ao assumir; usuários com Gerenciar threads têm o acesso inerente do Discord. Use canais privados para acesso automático de todos os cargos de suporte.

A conversa interna da equipe é uma **thread privada no canal privado de registros**, não no canal que o autor consegue ver. O responsável entra ao assumir. O autor não é adicionado. As notas internas do dashboard ficam no banco, separadas da transcrição entregue ao autor.

Ao encerrar o atendimento, a thread interna da equipe é trancada e arquivada, mesmo sem responsável atribuído e antes de excluir o canal principal. Falhas do Discord mantêm o ticket em encerramento para nova tentativa. Excluir o canal manualmente também encerra a thread; mensagens já apagadas não são recuperadas. Ao reabrir um ticket permitido, a thread interna é desbloqueada e desarquivada.

## Regras e persistência

- Limites ativos por servidor, por pessoa e por assunto; intervalo entre aberturas; prioridade por assunto.
- Contador contínuo ou reiniciado quando não há tickets ativos no respectivo grupo; contador global ou por assunto.
- Padrão de nome com `{{number}}`. Mensagens aceitam `{{user}}`, `{{server}}`, `{{ticketId}}`, `{{topic}}`, `{{staff}}` e `{{number}}`.
- Encerramento manual com motivo configurável ou automático após 24h, 48h ou sete dias sem mensagens humanas no canal. O processo verifica até cinco candidatos por servidor a cada minuto, sem se sobrepor.
- Ao encerrar: bloquear/arquivar ou excluir depois de capturar a transcrição. Excluir impede reabertura. A reabertura respeita limites ativos e invalida a transcrição anterior.
- Configurações, painéis, modelos, publicações e tickets sobrevivem ao reinício no mesmo volume SQLite. Rascunhos têm revisão para evitar sobrescrever uma edição concorrente. Alterar um rascunho não modifica a mensagem publicada nem seu formulário até a próxima publicação.
- Excluir um painel desativa novas aberturas por ele e preserva atendimentos existentes. Modelos JSON não incluem credenciais, conversas ou histórico; ao importar, revise IDs de canais/cargos para o servidor de destino.

## Transcrições e privacidade

Respostas, notas internas, motivos e snapshots de transcrição são criptografados com a chave existente da instalação (AES-256-GCM com contexto por ticket). Não existe link público de transcrição: leitura exige sessão autenticada ou interação Discord e nova verificação de acesso. O acesso do autor é opt-in. A entrega automática por DM é uma configuração independente e uma falha da DM não desfaz um encerramento.

O botão **Transcrição** no Discord e a entrega por DM enviam um HTML com o visualizador estilizado. O histórico do dashboard oferece **Ver transcrição**, que abre a mesma visualização autenticada. Há busca por mensagens, participantes, horários, embeds capturados e links de anexos, além de **Baixar HTML** e **Exportar JSON**. O HTML exportado funciona fora do dashboard; cópias baixadas ficam sob responsabilidade de quem as recebeu. Snapshots antigos permanecem legíveis, com os metadados que estavam disponíveis na captura.

A API JSON existente é mantida. `GET /api/guilds/:id/tickets/:ticketId/transcript/view` serve o visualizador e `/transcript/html` baixa HTML, sempre com sessão e nova verificação de acesso, sem URL pública. O HTML usa texto escapado, URLs HTTPS validadas e CSP com nonce; não interpreta HTML fornecido por usuários. Respostas não têm cache.

Os dados JSON incluem mensagens e links de anexos, e indicam `contentAvailable`, `truncated` e `capturedAt`. Não baixam arquivos externos. A captura é limitada às 5.000 mensagens mais recentes; o arquivo indica truncamento. Links de anexos podem expirar no Discord. **Transcrições com conteúdo completo exigem Message Content Intent**, habilitado no Developer Portal e `ENABLE_MESSAGE_CONTENT=true`. Sem isso, o arquivo sinaliza a limitação.

A retenção de 7, 30 ou 90 dias começa no encerramento. Ao expirar, respostas, notas, motivo e transcrição são removidos do registro; metadados do atendimento permanecem. Com retenção zero, essa limpeza acontece no encerramento. Auditoria retém apenas identificadores e ações por 90 dias. A retenção no banco não apaga embeds já enviados ao Discord. Cópias já exportadas ou entregues por DM não são revogadas. Backups seguem a política do operador e devem receber proteção e retenção próprias.

## Falhas e recuperação

Uma publicação incerta fica reservada no banco e não é repetida automaticamente. No diálogo de publicação, abra **Recuperar publicação**, confira o canal e, depois de 30 segundos, informe o ID da mensagem enviada pelo bot, ou confirme que nenhuma mensagem foi enviada para liberar nova tentativa. A mensagem vinculada deve ser do próprio bot, no canal configurado, com os controles desse painel. Para trocar clássico ↔ V2 em uma mensagem existente, duplique o painel e publique uma nova mensagem.

Uma criação incerta continua contando no limite para evitar duplicação. O bot tenta localizar o canal pelo marcador do ticket e recuperar o acesso. Depois de dois minutos, um gestor pode usar **Recuperar atendimento**; se nenhum canal existir, pode confirmar o cancelamento da reserva. Não apague manualmente registros pendentes do banco. Encerramentos interrompidos são retomados pela manutenção. Excluir um canal diretamente no Discord encerra seu registro, mas não recupera mensagens que já foram apagadas.

Nenhuma migração envia painéis, abre tickets ou altera canais existentes automaticamente. Todas as publicações e testes reais partem de uma ação confirmada no painel.

## Organização do código

- `shared/tickets.ts`: schemas e contratos; `shared/ticket-forms.ts`: tipos de campo e validação de respostas; `shared/ticket-i18n.ts`: traduções.
- `server/tickets/repository.ts`: tabelas, revisões, criptografia, auditoria e retenção; `routes.ts`: HTTP autenticado e CSRF.
- `server/bot/tickets/messages.ts`: mensagens clássicas/V2; `discord.ts`: operações do Discord; `service.ts`: regras e ciclo de vida; `interactions.ts`: despacho de interações; `forms.ts`: construção e leitura dos modais nativos.
- `server/bot/events/tickets.ts`: atividade e sincronização de exclusões.
- `server/tickets/transcript.ts`: renderização HTML, seleção de metadados públicos e exportação; `shared/transcript-style.ts`: estilo aprovado do visualizador.
- `web/tickets/`: páginas e componentes do dashboard, carregados sob demanda.
