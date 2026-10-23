import { loadConfig } from './config.js'
import { createApp } from './app.js'
const config = loadConfig()
const { app, bot } = await createApp(config)
try {
  await bot.start()
  await app.listen({ host: config.HOST, port: config.PORT })
} catch {
  app.log.error('Unable to start. Check bot credentials, enabled intents and server configuration.')
  await app.close()
  process.exitCode = 1
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, async () => {
    await app.close()
    process.exit(0)
  })
