import { REST, Routes } from 'discord.js';
import type { BotConfig } from '../config.js';
import { getChatCommandData } from './command-registry.js';

export async function registerCommands(config: BotConfig): Promise<void> {
  const token = config.discordToken;
  const clientId = config.clientId;
  if (!token || !clientId) {
    console.warn(
      'Skipping Discord command registration because DISCORD_TOKEN or CLIENT_ID is missing.',
    );
    return;
  }

  const commands = getChatCommandData();
  const rest = new REST().setToken(token);
  const guildId = config.guildId;
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);
  // ponytail: when guild-scoped, wipe any global commands left over from a previous global-scope run
  // so they don't show up as duplicates alongside the guild commands.
  const staleGlobalRoute = guildId ? Routes.applicationCommands(clientId) : null;

  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);
    await rest.put(route, { body: commands });
    if (staleGlobalRoute) {
      await rest.put(staleGlobalRoute, { body: [] });
    }
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
