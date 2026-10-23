# Arquitetura e segurança

O processo Node.js mantém o gateway Discord e o servidor Fastify. Em produção, o Fastify entrega o build React/Vite na mesma origem do dashboard. O SQLite é persistido em volume; o projeto inicial foi desenhado para uma instância.

## Comandos

Os adaptadores Discord convertem mensagens e interações em `Invocation`. O `CommandEngine` compartilha validação, cooldown, canais permitidos, regras por servidor e operações entre prefixo e slash. Respostas pessoais usam DM ou mensagens efêmeras. Componentes de confirmação são associados à pessoa e ao contexto original, consumidos uma única vez e expiram em cinco minutos.

O bot pede apenas Guilds e, quando habilitado, GuildMessages/MessageContent. Não pede Presence ou Guild Members Intent. O convite não inclui Administrator. Autocomplete é limitado e possui prazo curto para não prender a interação.

## Autenticação e autorização

- Discord: Authorization Code com `identify guilds`, state aleatório ligado ao navegador, expiração e consumo único. O login troca a sessão anterior por uma nova.
- Dashboard: os servidores são obtidos com o token OAuth do visitante; proprietário, Administrator ou Manage Guild permitem configuração. A autorização é reconsultada em cada rota de servidor, inclusive antes de salvar.
- Branilist: Authorization Code + PKCE S256. State é ligado à sessão Discord e ao usuário, não a um ID recebido do cliente. Os escopos solicitados são limitados às funcionalidades implementadas.
- Sessões: cookie HttpOnly/SameSite=Lax; em produção, Secure com prefixo `__Host-`. O identificador é armazenado como hash no banco.
- Escritas: exigem sessão, origem exata e token CSRF próprio da sessão. JSON é validado com schemas estritos.

Não há JWT de acesso aos serviços externos no navegador. API keys são usadas apenas para catálogo e não servem de fallback para operações pessoais. A própria API Branilist decide a privacidade dos perfis e das listas.

## Tokens e concorrência

Tokens de Discord/Branilist e os verifiers OAuth são criptografados com AES-256-GCM, nonce aleatório e AAD ligado ao registro. Sessões, states e vínculos não podem trocar payloads criptografados entre si sem falhar na autenticação.

Renovação Branilist é serializada por usuário: chamadas concorrentes aguardam a mesma troca, e o refresh token rotacionado é persistido antes de liberar as demais. Falhas temporárias não apagam o vínculo; uma resposta `invalid_grant` remove as credenciais inválidas. Operações OAuth e mutations não recebem retry automático.

Configurações usam revisão otimista, uma fila por servidor e auditoria apenas dos nomes dos campos alterados. Isso evita que duas sessões sobrescrevam configurações silenciosamente. Nicknames dependem das permissões e disponibilidade do Discord.

## Limites e exposição

Há limites HTTP por IP, validação de tamanho de corpo e parâmetros, cooldown de comandos, cache pequeno e curto somente para pesquisas públicas, além dos limites aplicados pelos serviços externos. Mensagens não geram menções automáticas. URLs de imagens devem ser HTTPS. HTML do catálogo é apresentado como texto, nunca com `dangerouslySetInnerHTML`.

O logger remove query strings das URLs para evitar registrar códigos OAuth, e não registra tokens/cookies. O histórico de comandos guarda servidor, nome do comando, resultado e horário, sem texto das mensagens, buscas ou payloads de API.

A política CSP de produção permite scripts da própria origem, bloqueia objetos e embedding em frames. Fontes são empacotadas localmente. Capas/avatares são carregados por HTTPS dos hosts externos originais.

## Demonstração e implantação

`DEMO_MODE` é um ambiente local com servidor/conta fictícios e banco em memória. Ele é explicitamente rotulado, não inicia o gateway, não chama OAuth real e não envia alterações externas. A configuração força bind em loopback e rejeita demo em produção.

O processo de publicação do código não cria aplicativos no Discord/Branilist nem instala o bot em servidores. O operador fornece e configura suas credenciais. Para uma implantação real, valide os callbacks, permissões, intents e escopos em um servidor de teste antes da abertura ao público.
