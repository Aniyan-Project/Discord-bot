# Branilist Bot

Um companheiro do Branilist para comunidades no Discord, com **comandos por prefixo e slash**, site público e dashboard. Integração feita com o pacote publicado [`@aniyan-project/branilist-api`](https://www.npmjs.com/package/@aniyan-project/branilist-api).

Português · English · Español — [English setup](docs/README.en.md) · [Guía en español](docs/README.es.md)

## O que está incluído

- Pesquisa de animes e mangás, catálogo em alta e consulta por ID Branilist, MyAnimeList ou AniList.
- Perfis públicos, vínculo de conta Branilist, biblioteca, progresso, remoção com confirmação, favoritos e coleções.
- Os mesmos 15 comandos por prefixo e slash, com aliases e descrições localizadas.
- Prefixo, idioma, apelido, cor, títulos, sinopses, capas, cooldown, canais e comandos configuráveis por servidor.
- Login do dashboard pelo Discord e verificação da permissão **Gerenciar Servidor** em cada acesso aos dados de um servidor.
- Site e dashboard responsivos em Português, Inglês e Espanhol, com prévia das respostas, busca, paginação, estados de erro e confirmação de ações destrutivas.
- OAuth/PKCE do Branilist, tokens criptografados em repouso, proteção CSRF, sessões persistentes e histórico operacional sem conteúdo de mensagens.
- SQLite, instalação via Docker, CI e testes de API, comandos, SDK, navegador e acessibilidade.

## Experimentar sem credenciais

Requer **Node.js 24.17 ou superior** e npm.

```sh
git clone https://github.com/Aniyan-Project/Discord-bot.git
cd Discord-bot
npm ci --ignore-scripts
npm run demo
```

Abra [localhost:5173](http://localhost:5173). A demonstração usa um servidor e uma conta fictícios, dados de catálogo obtidos pelo SDK e banco em memória. Alterações de configuração e biblioteca funcionam localmente; nenhuma alteração é enviada a Discord ou Branilist. A faixa de demonstração aparece no site e no painel. O modo demo só escuta no loopback e é proibido em produção.

## Configurar a instalação real

Copie `.env.example` para `.env` e preencha os valores. No PowerShell: `Copy-Item .env.example .env`.

### 1. Aplicativo Discord

Crie um aplicativo no [Discord Developer Portal](https://discord.com/developers/applications) e configure:

| Variável                | Valor                                                      |
| ----------------------- | ---------------------------------------------------------- |
| `DISCORD_TOKEN`         | Token da aba Bot                                           |
| `DISCORD_CLIENT_ID`     | Application ID                                             |
| `DISCORD_CLIENT_SECRET` | Client secret do OAuth2                                    |
| `APP_URL`               | Origem pública do site; localmente `http://localhost:5173` |

Cadastre no OAuth2 a URI **`APP_URL/auth/discord/callback`**. No ambiente local, use exatamente `http://localhost:5173/auth/discord/callback`.

Para comandos por prefixo, habilite **Message Content Intent** na aba Bot. O código não pede Guild Members ou Presence Intent. Se não for usar prefixo, defina `ENABLE_MESSAGE_CONTENT=false`; slash commands continuam disponíveis. Apps que precisarem de aprovação para o intent devem seguir as regras do Discord.

O convite pede `bot` e `applications.commands`, com permissões para ver canais, enviar mensagens, incorporar links, ler histórico e alterar o próprio apelido. **Não pede Administrator**. Use um aplicativo dedicado: o registro de slash commands substitui a lista de comandos desse aplicativo no escopo escolhido.

### 2. Aplicativo Branilist

Cadastre um cliente OAuth no painel de desenvolvedores do Branilist com a URI **`APP_URL/auth/branilist/callback`** e estes escopos:

```text
profile:read library:read library:write favourites:read collections:read
```

Preencha `BRANILIST_CLIENT_ID` e, para um cliente confidencial, `BRANILIST_CLIENT_SECRET`. A autenticação usa Authorization Code com PKCE S256. Cada pessoa autoriza sua própria conta pelo dashboard.

O catálogo público pode ser consultado anonimamente. `BRANILIST_API_KEY` é opcional para identificar a integração; se informado, precisa de `catalog:read` e `search:read`. A API key do operador **não substitui** o OAuth de uma pessoa para perfis e biblioteca. A API continua aplicando privacidade, bloqueios, escopos e limites.

Os templates e controles do bot são traduzidos. Títulos e sinopses usam os idiomas disponíveis no catálogo, sem tradução automática de conteúdo externo.

### 3. Chave de criptografia e banco

Gere a chave e guarde-a em `ENCRYPTION_KEY`:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use os 64 caracteres hexadecimais gerados. Mantenha a chave persistente e privada. Os tokens usam AES-256-GCM com vínculo ao registro de origem. Trocar/perder a chave torna sessões e vínculos antigos ilegíveis; preserve a chave junto à estratégia de backup, fora do repositório.

`DATABASE_PATH` define o arquivo SQLite. As tabelas são criadas na primeira inicialização. O histórico de comandos retém 30 dias; a auditoria de campos de configuração alterados, 90 dias. Não são armazenados textos de mensagens, termos das pesquisas ou conteúdo das respostas no histórico operacional.

### 4. Registrar comandos e iniciar

```sh
# Opcional: defina DISCORD_DEV_GUILD_ID para registrar apenas em um servidor de teste.
npm run commands:register
npm run dev
```

Sem `DISCORD_DEV_GUILD_ID`, o registro é global. O comando deve ser executado ao instalar ou alterar definições slash. As definições são localizadas; os nomes canônicos abaixo permanecem aceitos pelo prefixo.

## Comandos

O prefixo padrão é `b!`. No dashboard ou em `/settings`, cada servidor pode escolher outro prefixo.

| Slash canônico                    | Exemplo por prefixo                         | Função                                                       |
| --------------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| `/anime query`                    | `b!anime "Sousou no Frieren"`               | Buscar anime                                                 |
| `/manga query`                    | `b!manga "Vinland Saga"`                    | Buscar mangá                                                 |
| `/media id provider`              | `b!media 52991 mal`                         | Consultar por ID; provider: `branilist`, `mal`, `anilist`    |
| `/trending type`                  | `b!trending ANIME`                          | Em alta; `ANIME` ou `MANGA`                                  |
| `/profile username`               | `b!perfil nome`                             | Perfil público; sem nome, perfil da própria conta em privado |
| `/library status page`            | `b!biblioteca CURRENT 1`                    | Sua biblioteca, com paginação                                |
| `/progress media_id value status` | `b!progresso 79 5 CURRENT`                  | Atualizar progresso usando o ID interno Branilist            |
| `/remove media_id`                | `b!remover 79`                              | Remover da biblioteca, após confirmação                      |
| `/favourites`                     | `b!favoritos`                               | Seus favoritos de mídia                                      |
| `/collections`                    | `b!colecoes`                                | Suas coleções acessíveis                                     |
| `/connect`                        | `b!conectar`                                | Abrir o vínculo de conta                                     |
| `/disconnect`                     | `b!desconectar`                             | Remover o vínculo e revogar os tokens, após confirmação      |
| `/settings prefix language`       | `b!config prefix !` ou `b!config locale es` | Alterar prefixo/idioma; requer Gerenciar Servidor            |
| `/help`                           | `b!ajuda`                                   | Ajuda e comandos disponíveis                                 |
| `/ping`                           | `b!ping`                                    | Resposta de conectividade                                    |

Status aceitos: `PLANNING`, `CURRENT`, `COMPLETED`, `PAUSED`, `DROPPED`. O comando de progresso permite atualizar o status opcionalmente. Apelido, canais, aparência e ativação de comandos são ajustados no dashboard.

Ao escolher uma sugestão do autocomplete de `/anime` ou `/manga`, o bot consulta o ID selecionado e abre diretamente a ficha da obra. A ficha usa Components V2, com capa, status, nota, gêneros, sinopse e relações disponíveis após uma divisória. Prequelas e sequências têm prioridade; até seis relações aparecem na mensagem, com acesso às demais pelo catálogo. As preferências de idioma, cor, capas e sinopses do servidor continuam valendo. Pesquisas livres com vários resultados mantêm a lista de resultados.

Respostas de biblioteca, favoritos, coleções, configurações e alterações pessoais são privadas: efêmeras no slash e por DM no prefixo. Se a DM estiver bloqueada, o bot orienta usar slash. Botões de confirmação pertencem à pessoa que iniciou a ação e expiram em cinco minutos.

Pesquisas, autocomplete e prévias filtram conteúdo adulto. Este projeto não oferece comandos de moderação, música, leitura de DMs de terceiros ou funções administrativas do Branilist.

## Produção com Docker

Defina `APP_URL=https://seu-dominio` e registre as duas URIs OAuth correspondentes antes de iniciar. Não use `DEMO_MODE=true` em produção.

```sh
docker compose up -d --build
docker compose logs -f app
```

O serviço fica disponível em `127.0.0.1:4100`, para uso atrás de um proxy HTTPS. O volume `bot-data` mantém o SQLite. O container roda sem root.

Para usar o proxy Caddy incluído, aponte um domínio para o servidor, disponibilize as portas 80/443 e acrescente `BOT_DOMAIN=seu-dominio` ao `.env`:

```sh
docker compose --profile proxy up -d --build
```

O Compose confia em proxies da rede privada porque a porta do backend só é publicada no loopback. Se mudar a topologia ou expuser o backend, ajuste `TRUST_PROXY` para os IPs/CIDRs exatos do seu proxy. Fora do Compose, a confiança está desativada por padrão. Não aceite headers de proxy de conexões não confiáveis.

Sem Docker: execute `npm run build`, configure o ambiente de produção e use `npm start`. O Fastify serve o site compilado e a API na mesma origem. A instalação inicial usa um processo com SQLite; não execute réplicas concorrentes do gateway com o mesmo bot token. Sharding e infraestrutura distribuída exigem evolução da implantação.

Para backup por cópia, pare o processo antes de copiar o banco/volume. Para backup em execução, use mecanismos de backup consistentes do SQLite. Proteja também a chave de criptografia. Revise `.env`, permissões do volume e configuração de proxy antes de expor o serviço.

## Desenvolvimento e verificação

```sh
npm run format:check
npm run check
npm run test:production
npx playwright install chromium
npm run test:ui
```

Os testes usam mocks, injeção HTTP e a demonstração local. Não registram comandos reais, não enviam mensagens ao Discord e não executam mutations no Branilist de produção. As verificações de acessibilidade automatizadas complementam a revisão de teclado e layout.

Estrutura:

```text
server/       Gateway Discord, OAuth, API do dashboard, integração SDK e SQLite
web/          Site, dashboard e estilos responsivos
shared/       Contratos, validação, três idiomas e exemplos do catálogo
tests/        Segurança, comandos, integração SDK, produção e navegador
deploy/       Exemplo de proxy HTTPS
```

Consulte [arquitetura e segurança](docs/architecture.md), [privacidade operacional](docs/privacy.md) e [contribuição](CONTRIBUTING.md).

## Licença

Código sob [MIT](LICENSE). Discord, Branilist e suas APIs mantêm suas próprias regras e limites. O uso do serviço Branilist segue os [Termos da API](https://docs.branilist.com/guide/terms-of-use.html). A licença do código não substitui esses termos. As capas vêm dos hosts indicados pelo catálogo; direitos das obras pertencem aos respectivos titulares.
