# Contribuindo

Use Node.js 24.17 ou superior. Comece com `npm ci --ignore-scripts` e `npm run demo`.

- Discuta mudanças maiores em uma issue antes de implementar.
- Mantenha os mesmos comportamentos em prefixo e slash; regras de comando pertencem ao `CommandEngine`.
- Crie comandos, eventos e handlers em módulos de `server/bot/`, seguindo o [guia de organização e extensão](docs/bot-development.md). Evite adicionar condições por nome no runtime.
- Acrescente as três traduções ao alterar uma mensagem em `shared/i18n.ts`.
- Use o SDK publicado para operações Branilist. Não introduza chamadas à API interna do site.
- Não inclua tokens, client secrets, chaves, bancos locais ou `.env` em commits.
- Acrescente testes para autorização, isolamento entre servidores, OAuth e alterações pessoais.
- Execute `npm run format`, `npm run check`, `npm run test:production` e `npm run test:ui`.
- Ao alterar comandos slash, documente a necessidade de executar `npm run commands:register`.

Os testes não devem depender de contas reais nem escrever em serviços de produção. Contribuições usam a licença MIT do projeto.
