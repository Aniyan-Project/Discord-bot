import test from 'node:test'
import assert from 'node:assert/strict'
import { Events, MessageFlags } from 'discord.js'
import { loadConfig } from '../server/config.js'
import { Store } from '../server/store.js'
import { BranilistService } from '../server/branilist.js'
import { BotRuntime } from '../server/bot/runtime.js'
import { commandRegistry, commands, findCommand } from '../server/bot/commands/registry.js'
import { parsePrefix } from '../server/bot/parsing/prefix.js'
import type { Invocation } from '../server/bot/core/types.js'
import type { CommandId } from '../shared/domain.js'
import { ConfirmationSessions } from '../server/bot/interactions/confirmations.js'
import { CommandPolicy } from '../server/bot/core/policy.js'

function fixture() {
  const config = loadConfig({
    NODE_ENV: 'test',
    DEMO_MODE: 'true',
    DATABASE_PATH: ':memory:',
    ENCRYPTION_KEY: '55'.repeat(32),
  })
  const store = new Store(':memory:', config.ENCRYPTION_KEY)
  return { store, bot: new BotRuntime(config, store, new BranilistService(config, store)) }
}
test('slash dispatch uses each command module for arguments and private acknowledgement', async () => {
  const { store, bot } = fixture()
  const values: Record<string, string> = {
    query: 'branilist:79',
    id: '79',
    provider: 'mal',
    username: 'hanami',
    type: 'MANGA',
    status: 'CURRENT',
    media_id: '79',
    prefix: '?',
    language: 'es',
  }
  const expected: Partial<Record<CommandId, string[]>> = {
    anime: ['branilist:79'],
    manga: ['branilist:79'],
    media: ['79', 'mal'],
    trending: ['MANGA'],
    profile: ['hanami'],
    library: ['CURRENT', '2'],
    progress: ['79', '7', 'CURRENT'],
    remove: ['79'],
    settings: ['prefix', '?', 'language', 'es'],
  }
  let invoked: { command: CommandId; args: string[]; context: Invocation } | undefined
  let acknowledged = false
  bot.engine.execute = async (command, args, context) => {
    assert.equal(acknowledged, true)
    invoked = { command, args, context }
    return { content: 'ok' }
  }
  try {
    for (const command of commands) {
      acknowledged = false
      invoked = undefined
      let privateReply = false
      const interaction = {
        isChatInputCommand: () => true,
        commandName: command.id,
        options: {
          getString: (name: string) => values[name] ?? null,
          getInteger: (name: string) => (name === 'page' ? 2 : 7),
        },
        guildId: 'guild',
        channelId: 'channel',
        channel: { isThread: () => false },
        user: { id: 'owner' },
        locale: 'en',
        memberPermissions: { has: () => false },
        deferred: false,
        replied: false,
        async deferReply(options: { flags?: number }) {
          acknowledged = true
          privateReply = options.flags === MessageFlags.Ephemeral
          this.deferred = true
        },
        async editReply() {},
        async reply() {
          assert.fail('unexpected error reply')
        },
      }
      await bot.client.listeners(Events.InteractionCreate)[0]!(interaction)
      const call = invoked as { command: CommandId; args: string[]; context: Invocation } | undefined
      assert.equal(call?.command, command.id)
      assert.deepEqual(call?.args, expected[command.id] ?? [])
      assert.equal(call?.context.source, 'slash')
      assert.equal(
        privateReply,
        [
          'library',
          'progress',
          'remove',
          'favourites',
          'collections',
          'connect',
          'disconnect',
          'settings',
        ].includes(command.id),
      )
    }
  } finally {
    await bot.close()
    store.close()
  }
})

test('prefix aliases dispatch through the same engine and private replies never leak when DMs fail', async () => {
  const { store, bot } = fixture()
  let invoked = false,
    reply: unknown
  bot.engine.execute = async (command, args, context) => {
    invoked = true
    assert.equal(command, 'profile')
    assert.deepEqual(args, ['hanami'])
    assert.equal(context.source, 'prefix')
    return { private: true, content: 'sensitive-response' }
  }
  try {
    const message = {
      content: 'b!perfil hanami',
      guildId: 'guild',
      channelId: 'channel',
      channel: { isThread: () => false },
      member: { permissions: { has: () => false } },
      author: {
        id: 'owner',
        bot: false,
        async send() {
          throw Error('DM closed')
        },
      },
      async react() {
        assert.fail('DM was not sent')
      },
      async reply(value: unknown) {
        reply = value
      },
    }
    await bot.client.listeners(Events.MessageCreate)[0]!(message)
    assert.equal(invoked, true)
    assert.ok(reply)
    assert.ok(!JSON.stringify(reply).includes('sensitive-response'))
    assert.deepEqual((reply as { allowedMentions: unknown }).allowedMentions, {
      parse: [],
      repliedUser: false,
    })
    assert.equal(parsePrefix('b!constructor', 'b!'), null)
    assert.equal(parsePrefix('b!__proto__', 'b!'), null)
    assert.equal(findCommand('constructor'), undefined)
  } finally {
    await bot.close()
    store.close()
  }
})

test('autocomplete is an optional command hook and its cooldown remains local to each runtime', async () => {
  const first = fixture(),
    second = fixture(),
    original = commandRegistry.ping.autocomplete
  commandRegistry.ping.autocomplete = async (query) => [{ name: query, value: 'chosen' }]
  const responses: unknown[] = []
  const interaction = {
    isChatInputCommand: () => false,
    isAutocomplete: () => true,
    commandName: 'ping',
    options: { getFocused: () => 'example' },
    user: { id: 'same-user' },
    guildId: null,
    async respond(value: unknown) {
      responses.push(value)
    },
  }
  try {
    await first.bot.client.listeners(Events.InteractionCreate)[0]!(interaction)
    await first.bot.client.listeners(Events.InteractionCreate)[0]!(interaction)
    await second.bot.client.listeners(Events.InteractionCreate)[0]!(interaction)
    assert.deepEqual(responses, [
      [{ name: 'example', value: 'chosen' }],
      [],
      [{ name: 'example', value: 'chosen' }],
    ])
  } finally {
    commandRegistry.ping.autocomplete = original
    await first.bot.close()
    await second.bot.close()
    first.store.close()
    second.store.close()
  }
})

test('unrelated interactions are ignored and runtime shutdown removes only its registered event handlers', async () => {
  const { store, bot } = fixture(),
    events = [Events.InteractionCreate, Events.MessageCreate, Events.Error] as const
  const listeners = events.map((event) => [event, bot.client.listeners(event)] as const)
  try {
    for (const [, list] of listeners) assert.equal(list.length, 1)
    const interaction = {
      isChatInputCommand: () => false,
      isAutocomplete: () => false,
      isStringSelectMenu: () => false,
      isButton: () => true,
      customId: 'unrelated-button',
    }
    await bot.client.listeners(Events.InteractionCreate)[0]!(interaction)
    await bot.close()
    for (const [event, list] of listeners)
      for (const listener of list) assert.ok(!bot.client.listeners(event).includes(listener))
  } finally {
    store.close()
  }
})

test('confirmation sessions execute a command-supplied action once and cancellation never runs it', async () => {
  const { bot, store } = fixture()
  const sessions = new ConfirmationSessions(store, new CommandPolicy(store))
  const ctx: Invocation = {
    userId: 'owner',
    channelId: 'dm',
    locale: 'en',
    manageGuild: false,
    source: 'slash',
  }
  let count = 0
  const task = {
    prompt: 'confirmRemove' as const,
    success: 'removed' as const,
    execute: async () => {
      count++
    },
  }
  try {
    const pending = sessions.create(ctx, 'ping', task).confirm!.token
    await assert.rejects(sessions.confirm(pending, { ...ctx, userId: 'other' }), /ownButtonOnly/)
    assert.equal(count, 0)
    await sessions.confirm(pending, ctx)
    assert.equal(count, 1)
    await assert.rejects(sessions.confirm(pending, ctx), /expired/)
    const cancelled = sessions.create(ctx, 'ping', task).confirm!.token
    await sessions.confirm(cancelled, ctx, true)
    assert.equal(count, 1)
  } finally {
    await bot.close()
    store.close()
  }
})
