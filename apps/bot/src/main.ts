// Must be the first import: Sentry's auto-instrumentation has to patch
// Node's http/fs modules before anything else (including discord.js) loads them.
import './instrument.js';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { loadBotConfig } from './config.js';
import { routeInteraction } from './discord/interaction-router.js';
import { registerCommands } from './discord/register-commands.js';
import { startBotHttpServer } from './http-server.js';
import { loginToDiscordWithRetry } from './startup.js';

const config = loadBotConfig();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

let httpServerStarted = false;

async function ensureHttpServerStarted(): Promise<void> {
  if (httpServerStarted) {
    return;
  }

  await startBotHttpServer(client, config);
  httpServerStarted = true;
}

async function handleClientReady(): Promise<void> {
  try {
    console.log(`Logged in as ${client.user?.tag}`);
    await registerCommands(config);
  } catch (error) {
    console.error('[discord] Ready handler failed:', error);
  }
}

client.once(Events.ClientReady, () => {
  void handleClientReady();
});

client.on(Events.Error, (error) => {
  console.error('[discord] Client error:', error);
});

client.on(Events.Warn, (warning) => {
  console.warn('[discord] Client warning:', warning);
});

client.on(Events.InteractionCreate, (interaction) => {
  void routeInteraction(interaction).catch((error) => {
    console.error('[discord] Interaction routing failed:', error);
  });
});

const token = config.discordToken;
if (!token) {
  console.error('DISCORD_TOKEN is not set — bot will not start.');
  process.exit(1);
}
const discordToken = token;

async function start(): Promise<void> {
  try {
    await ensureHttpServerStarted();
    await loginToDiscordWithRetry(client, discordToken);
  } catch (error) {
    console.error('[discord] Unable to start bot:', error);
    process.exit(1);
  }
}

void start();
