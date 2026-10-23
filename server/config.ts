import 'dotenv/config'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { defaultSettings, guildSettingsSchema } from '../shared/domain.js'
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  HOST: z.string().default('127.0.0.1'),
  TRUST_PROXY: z.string().default(''),
  APP_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_PATH: z.string().default('./data/branilist-bot.sqlite'),
  ENCRYPTION_KEY: z.string().default(''),
  DISCORD_TOKEN: z.string().default(''),
  DISCORD_CLIENT_ID: z.string().default(''),
  DISCORD_CLIENT_SECRET: z.string().default(''),
  DISCORD_DEV_GUILD_ID: z.string().default(''),
  ENABLE_MESSAGE_CONTENT: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  DEFAULT_PREFIX: z.string().default('b!'),
  DEFAULT_LOCALE: z.enum(['pt-BR', 'en', 'es']).default('pt-BR'),
  BRANILIST_API_KEY: z.string().default(''),
  BRANILIST_CLIENT_ID: z.string().default(''),
  BRANILIST_CLIENT_SECRET: z.string().default(''),
  BRANILIST_GRAPHQL_URL: z.string().url().default('https://branilist.com/api/graphql'),
  BRANILIST_ISSUER: z.string().url().default('https://branilist.com'),
  SUPPORT_URL: z.string().url().default('https://github.com/Aniyan-Project/Discord-bot/issues'),
  DEMO_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
})
export type Config = z.infer<typeof envSchema>
export function loadConfig(source: Record<string, string | undefined> = process.env): Config {
  const config = envSchema.parse(source)
  const url = new URL(config.APP_URL)
  if (url.pathname !== '/' || url.username || url.password || url.search || url.hash)
    throw Error('APP_URL must be an origin without a path')
  config.APP_URL = url.origin
  if (config.NODE_ENV === 'production' && url.protocol !== 'https:')
    throw Error('Production APP_URL requires HTTPS')
  if (config.DEMO_MODE && config.NODE_ENV === 'production')
    throw Error('Demo mode is forbidden in production')
  if (config.DEMO_MODE) {
    config.HOST = '127.0.0.1'
    config.ENCRYPTION_KEY ||= randomBytes(32).toString('hex')
  }
  if (!/^[a-fA-F0-9]{64}$/.test(config.ENCRYPTION_KEY))
    throw Error('ENCRYPTION_KEY must contain 32 random bytes encoded as 64 hex characters')
  if (
    !config.DEMO_MODE &&
    (!config.DISCORD_TOKEN || !config.DISCORD_CLIENT_ID || !config.DISCORD_CLIENT_SECRET)
  )
    throw Error('Configure Discord credentials, or use npm run demo locally')
  guildSettingsSchema.parse({
    ...defaultSettings,
    prefix: config.DEFAULT_PREFIX,
    locale: config.DEFAULT_LOCALE,
    prefixEnabled: config.ENABLE_MESSAGE_CONTENT,
  })
  return config
}
