# Branilist Bot — Guía en español

Un compañero de Discord de código abierto, construido con el paquete npm publicado `@aniyan-project/branilist-api`. Incluye búsquedas de anime/manga, perfiles públicos, vinculación de cuenta, actualizaciones privadas de biblioteca, favoritos, colecciones y sitio/dashboard multilingüe.

## Probar localmente

El dashboard también incluye un **Creador de mensajes** con embeds clásicos o Components V2, vista en vivo, variables del servidor/remitente, importación/exportación JSON y un borrador persistente por usuario/servidor. Envía como bot o webhook con nombre y URL de avatar personalizados. Tú y el bot necesitan Ver canal, Enviar mensajes e Insertar enlaces; los webhooks también requieren Gestionar webhooks en el canal de destino. Las menciones están desactivadas inicialmente. Revisa el mensaje antes de confirmar. En modo demo solo se simula el envío. Consulta la [guía completa](message-builder.md) (portugués).

La API de demostración local usa el puerto 4101 y el sitio el 5173, evitando el puerto 4100 de producción.

Requiere Node.js 24.17+:

```sh
npm ci --ignore-scripts
npm run demo
```

Abre http://localhost:5173. La demostración está identificada, usa loopback, una base de datos en memoria y datos ficticios de Discord/cuenta. No se conecta a Discord ni modifica datos del Branilist de producción.

## Configurar una instalación real

1. Copia `.env.example` a `.env`.
2. Crea una aplicación Discord. Configura `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` y `DISCORD_CLIENT_SECRET`. Registra `APP_URL/auth/discord/callback` como URI de retorno.
3. Activa Message Content Intent para comandos con prefijo, o configura `ENABLE_MESSAGE_CONTENT=false` para usar solo slash.
4. Crea una aplicación OAuth de Branilist con `APP_URL/auth/branilist/callback`. Autoriza `profile:read library:read library:write favourites:read collections:read`. Configura `BRANILIST_CLIENT_ID` y el secreto opcional de cliente confidencial.
5. Genera `ENCRYPTION_KEY` con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Guárdala de forma privada y persistente.
6. Ejecuta `npm run commands:register`. Con `DISCORD_DEV_GUILD_ID` se limita el registro a un servidor de prueba. Sin esa variable, es global y sustituye los comandos de esta aplicación.
7. Ejecuta `npm run dev`, o compila con `npm run build` e inicia con `npm start` y la configuración de producción.

El catálogo admite consultas anónimas. La API key opcional del operador requiere `catalog:read` y `search:read`; no sustituye la autorización OAuth de cada persona para funciones de cuenta. Se respetan privacidad, permisos y límites del Branilist. Las plantillas del bot, las descripciones slash y los controles del panel están disponibles en portugués, inglés y español. El contenido del catálogo conserva sus idiomas disponibles.

El dashboard verifica Gestionar servidor/Administrator/propiedad en cada ruta. Las respuestas personales son efímeras en slash y privadas por DM con prefijo. Las acciones destructivas requieren confirmación de la persona que inició el comando.

Consulta la [tabla de comandos y Docker](../README.md), la [arquitectura](architecture.md) y el [manejo de datos](privacy.md). En producción, usa HTTPS y conserva el volumen SQLite y la clave. El perfil Compose de Caddy puede proporcionar TLS para un dominio configurado por el operador.

MIT se aplica al código. Los servicios de Discord y Branilist mantienen sus propios términos.
