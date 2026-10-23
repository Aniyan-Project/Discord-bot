# Dados operacionais

Este documento descreve o comportamento do código. Cada operador deve disponibilizar suas próprias informações de contato e política aplicável à sua instalação.

| Dado                                                            | Finalidade                                     | Retenção implementada                                           |
| --------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| ID/nome/avatar Discord da sessão                                | Identificar a pessoa no dashboard              | Sessão de até 7 dias                                            |
| Tokens OAuth Discord                                            | Consultar os servidores gerenciáveis           | Sessão de até 7 dias, criptografados                            |
| Tokens OAuth Branilist e dados básicos do vínculo               | Executar operações autorizadas da pessoa       | Até desvincular, revogar ou invalidar o vínculo; criptografados |
| States/verifiers OAuth                                          | Proteger a autorização                         | Até consumo ou 10 minutos                                       |
| Configurações por servidor                                      | Prefixo, idioma, canais e recursos habilitados | Enquanto a instalação mantiver o banco                          |
| Metadados de uso de comandos                                    | Diagnóstico operacional                        | 30 dias                                                         |
| ID do administrador e nomes de campos de configuração alterados | Auditoria de configuração                      | 90 dias                                                         |

A limpeza ocorre na inicialização e a cada hora. O código não salva conteúdo de mensagens, termos de busca nem respostas da API no histórico operacional. Pesquisas públicas podem ficar por até 30 segundos em cache na memória do processo, limitado a 100 entradas.

Ao desvincular Branilist, os tokens locais são removidos e a revogação remota é tentada para access/refresh tokens. Em uma indisponibilidade remota, a pessoa pode revogar a autorização também no painel de aplicativos do Branilist. Sair do dashboard encerra a sessão local real; não apaga o vínculo Branilist, que é uma escolha separada.

Capas e avatares são carregados de hosts externos, que podem receber IP e informações normais da requisição. A política de referrer do aplicativo é `no-referrer`. O operador também deve revisar a retenção de logs do proxy e do provedor de hospedagem.

Proteja o volume do SQLite e a chave `ENCRYPTION_KEY`; não os publique. Para solicitar remoção de dados de uma instalação, procure seu operador. Para revogar uma integração de conta, use também os controles de aplicativos autorizados do Discord e do Branilist.
