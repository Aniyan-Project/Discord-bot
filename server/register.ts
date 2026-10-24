import 'dotenv/config'
import { REST, Routes } from 'discord.js'
import { createSlashCommands } from './bot/registration/slash-commands.js'
const { DISCORD_TOKEN: token, DISCORD_CLIENT_ID: clientId, DISCORD_DEV_GUILD_ID: guildId } = process.env
if (!token || !clientId || !/^\d{17,20}$/.test(clientId))
  throw Error('Configure DISCORD_TOKEN and DISCORD_CLIENT_ID before registering slash commands')
if (guildId && !/^\d{17,20}$/.test(guildId)) throw Error('Invalid DISCORD_DEV_GUILD_ID')
const rest = new REST({ version: '10' }).setToken(token)
const commands = createSlashCommands()
await rest.put(
  guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId),
  { body: guildId ? commands.map(({ contexts: _contexts, ...command }) => command) : commands },
)
console.log(
  `Registered ${createSlashCommands().length} slash commands ${guildId ? 'in the development guild' : 'globally'}.`,
)
