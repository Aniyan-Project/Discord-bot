# Branilist Bot — English setup

An open-source Discord companion built with the published `@aniyan-project/branilist-api` npm SDK. Includes anime/manga search, public profiles, account linking, private library updates, favourites, collections and a multilingual website/dashboard.

## Try locally

Requires Node.js 24.17+:

```sh
npm ci --ignore-scripts
npm run demo
```

Open http://localhost:5173. The clearly labelled demo runs on loopback with an in-memory database and fictitious Discord/account data. It never connects to Discord or changes production Branilist data.

## Configure a real installation

1. Copy `.env.example` to `.env`.
2. Create a Discord application. Set `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`. Register `APP_URL/auth/discord/callback` as its redirect URI.
3. Enable Message Content Intent for prefix commands, or set `ENABLE_MESSAGE_CONTENT=false` to use slash commands only.
4. Create a Branilist OAuth application and register `APP_URL/auth/branilist/callback`. Allow `profile:read library:read library:write favourites:read collections:read`. Set `BRANILIST_CLIENT_ID` and its optional confidential-client secret.
5. Generate `ENCRYPTION_KEY` using `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and keep it private and persistent.
6. Run `npm run commands:register`. Optional `DISCORD_DEV_GUILD_ID` limits registration to a test server. Otherwise registration is global and replaces this application's command list.
7. Run `npm run dev`, or build with `npm run build` and start with `npm start` under production configuration.

The catalog supports anonymous requests. An optional operator API key requires `catalog:read` and `search:read`; it cannot replace a user's OAuth authorization for account features. Responses respect Branilist privacy and permissions. All bot templates, slash descriptions and dashboard controls support Portuguese, English and Spanish; catalog text uses its available source languages.

The dashboard checks Manage Server/Administrator/ownership on every server route. Library/account responses are ephemeral for slash commands and sent by DM for prefix commands. Destructive actions require an owner-bound confirmation.

See the [command table and Docker instructions](../README.md), [architecture](architecture.md) and [data handling](privacy.md). For production use HTTPS and preserve the SQLite volume and encryption key. The optional Caddy Compose profile can provide TLS for an operator-configured domain.

MIT applies to this code. Discord and Branilist API terms still apply to their services.
