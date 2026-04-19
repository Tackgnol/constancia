import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Events,
  MessageFlags,
  type InteractionReplyOptions,
  type InteractionEditReplyOptions,
} from 'discord.js';
import { handleRoll } from './commands/roll.js';
import { handleJournal } from './commands/journal.js';
import { handleNpcs } from './commands/npcs.js';
import { handleLogin } from './commands/login.js';
import { handleSetup } from './commands/setup.js';
import { handleParticipants } from './commands/participants.js';

const commands = [
  { name: 'roll', description: 'Fire the active event in this channel' },
  { name: 'journal', description: 'View your quest journal and session summaries' },
  { name: 'npcs', description: 'View NPCs you know about' },
  { name: 'login', description: 'Get a magic link to log in to the web dashboard' },
  { name: 'setup', description: 'Initialize this channel and server for use with Constancia' },
  {
    name: 'participants',
    description: 'Manage campaign participants',
    options: [
      {
        name: 'add',
        type: 1,
        description: 'Add a player as a participant',
        options: [
          {
            name: 'user',
            type: 6,
            description: 'The Discord user to add',
            required: true,
          },
        ],
      },
      {
        name: 'remove',
        type: 1,
        description: 'Remove a participant from the campaign',
        options: [
          {
            name: 'user',
            type: 6,
            description: 'The Discord user to remove',
            required: true,
          },
        ],
      },
      {
        name: 'list',
        type: 1,
        description: 'List current campaign participants',
      },
    ],
  },
];

async function registerCommands(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  if (!token || !clientId) return;

  const rest = new REST().setToken(token);
  const guildId = process.env.GUILD_ID;
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);
    await rest.put(route, { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error while refreshing application (/) commands:', error);
    if (error instanceof Error && error.message.includes('Missing Access')) {
      console.error(
        'TIP: This usually means the bot is missing the "applications.commands" scope in its invite link ' +
          'or it is not in the server with the ID provided in GUILD_ID.',
      );
    }
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user?.tag}`);
  await registerCommands();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'roll') await handleRoll(interaction);
    else if (interaction.commandName === 'journal') await handleJournal(interaction);
    else if (interaction.commandName === 'npcs') await handleNpcs(interaction);
    else if (interaction.commandName === 'login') await handleLogin(interaction);
    else if (interaction.commandName === 'setup') await handleSetup(interaction);
    else if (interaction.commandName === 'participants') await handleParticipants(interaction);
  } catch (err) {
    console.error('Command error:', err);
    const msg = {
      content: 'Something went wrong.',
      flags: MessageFlags.Ephemeral,
    } as InteractionReplyOptions & InteractionEditReplyOptions;
    if (interaction.deferred) await interaction.editReply(msg);
    else await interaction.reply(msg);
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN is not set — bot will not start.');
  process.exit(1);
}

client.login(token);
