import {
  ApplicationCommandOptionType,
  MessageFlags,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
  type InteractionDeferReplyOptions,
} from 'discord.js';
import { botRequestOptions } from '../config.js';
import { listGameSystems } from '../api/generated/endpoints/systems/systems.js';
import { setupChannel } from '../api/generated/endpoints/bot/bot.js';
import { syncParticipants } from '../api/participants.js';
import type { BotChatCommand } from '../discord/command-types.js';

const DEFAULT_GAME_SYSTEM_ID = 'vtm-v5';
const GAME_SYSTEM_OPTION_NAME = 'game-system';

export async function autocompleteSetup(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== GAME_SYSTEM_OPTION_NAME) {
    await interaction.respond([]);
    return;
  }

  const systems = await listGameSystems(botRequestOptions());
  const query = String(focused.value ?? '').trim().toLowerCase();
  const choices = systems.data
    .filter((system) => {
      if (!query) {
        return true;
      }

      return (
        system.id.toLowerCase().includes(query) ||
        system.name.toLowerCase().includes(query) ||
        system.version.toLowerCase().includes(query)
      );
    })
    .slice(0, 25)
    .map((system) => ({
      name: `${system.name} (${system.version})`,
      value: system.id,
    }));

  await interaction.respond(choices);
}

export async function handleSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral } as InteractionDeferReplyOptions);

  try {
    const guildId = interaction.guildId;
    const guildName = interaction.guild?.name;
    const discordChannelId = interaction.channelId;
    const channelName =
      interaction.channel && 'name' in interaction.channel
        ? (interaction.channel.name ?? 'unknown')
        : 'unknown';

    if (!guildId || !guildName) {
      await interaction.editReply('This command can only be used in a server.');
      return;
    }

    const gameSystemId =
      interaction.options.getString(GAME_SYSTEM_OPTION_NAME) ?? DEFAULT_GAME_SYSTEM_ID;

    const response = await setupChannel(
      {
        guildId,
        guildName,
        discordChannelId,
        channelName,
        campaignName: guildName,
        gameSystemId,
      },
      botRequestOptions(),
    );

    if (response.status === 'ok') {
      const { campaign, channel, created } = response.data;
      let message =
        `Successfully linked this channel to Constancia!\n` +
        `- **Campaign**: ${campaign.name} ${created.campaign ? '(New)' : '(Existing)'}\n` +
        `- **Channel**: ${channel.name} ${created.channel ? '(New)' : '(Existing)'}`;

      if (created.campaign) {
        message +=
          '\n\nSince this is a new campaign, you might want to visit the dashboard to configure it.';
      }

      // Auto-register the GM who ran /setup as the first participant (non-fatal)
      try {
        const member = interaction.member as GuildMember | null;
        const discordName =
          member?.displayName ?? interaction.user.displayName ?? interaction.user.username;
        await syncParticipants(
          { guildId, participants: [{ discordUserId: interaction.user.id, discordName }] },
          botRequestOptions(),
        );
      } catch (syncErr) {
        console.error('Setup: failed to auto-register caller as participant:', syncErr);
      }

      await interaction.editReply(message);
    } else {
      await interaction.editReply('Failed to setup channel. Backend returned an error.');
    }
  } catch (error) {
    console.error('Setup command error:', error);
    await interaction.editReply('Failed to setup channel. Please try again later.');
  }
}

export const setupCommand: BotChatCommand = {
  data: {
    name: 'setup',
    description: 'Initialize this channel and server for use with Constancia',
    options: [
      {
        name: GAME_SYSTEM_OPTION_NAME,
        type: ApplicationCommandOptionType.String,
        description: 'Choose the game system for the linked campaign',
        required: false,
        autocomplete: true,
      },
    ],
  },
  execute: handleSetup,
  autocomplete: autocompleteSetup,
};

