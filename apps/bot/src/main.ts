import {
  Client,
  GatewayIntentBits,
  Events,
} from 'discord.js';
import { loadBotConfig } from './config.js';
import { routeInteraction } from './discord/interaction-router.js';
import { registerCommands } from './discord/register-commands.js';
import { startBotHttpServer } from './http-server.js';

const config = loadBotConfig();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

let httpServerStarted = false;

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user?.tag}`);
  await registerCommands(config);

  if (!httpServerStarted) {
    await startBotHttpServer(client, config);
    httpServerStarted = true;
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  await routeInteraction(interaction);
});

const token = config.discordToken;
if (!token) {
  console.error('DISCORD_TOKEN is not set — bot will not start.');
  process.exit(1);
}

client.login(token);
