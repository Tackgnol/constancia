import {
  ApplicationCommandOptionType,
  MessageFlags,
  type ChatInputCommandInteraction,
  type GuildMember,
  type InteractionDeferReplyOptions,
} from 'discord.js';
import { botRequestOptions } from '../config.js';
import {
  getCampaignByGuild,
  removeParticipant,
  syncParticipants,
} from '@constancia/api-client/endpoints/bot/bot';
import { listCharacters } from '@constancia/api-client/endpoints/characters/characters';
import type { BotChatCommand } from '../discord/command-types.js';

export async function handleParticipants(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral } as InteractionDeferReplyOptions);

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply('This command can only be used in a server.');
    return;
  }

  const sub = interaction.options.getSubcommand();

  try {
    if (sub === 'add') {
      const user = interaction.options.getUser('user', true);
      const member = interaction.options.getMember('user') as GuildMember | null;
      const discordName = member?.displayName ?? user.displayName ?? user.username;

      const result = await syncParticipants(
        { guildId, participants: [{ discordUserId: user.id, discordName }] },
        botRequestOptions(),
      );

      if (result.status === 'ok') {
        await interaction.editReply(
          `✓ **${discordName}** added as a participant.\nGM can set their in-game name on the dashboard.`,
        );
      } else {
        await interaction.editReply('Failed to add participant. Please try again.');
      }
    } else if (sub === 'remove') {
      const user = interaction.options.getUser('user', true);

      const result = await removeParticipant(
        { guildId, discordUserId: user.id },
        botRequestOptions(),
      );

      if (result.deleted) {
        await interaction.editReply(`✓ **${user.username}** removed from the campaign.`);
      } else {
        await interaction.editReply(`${user.username} is not a registered participant.`);
      }
    } else if (sub === 'list') {
      const campaignResult = await getCampaignByGuild({ guildId }, botRequestOptions());
      if (campaignResult.status !== 'ok') {
        await interaction.editReply('This server has no campaign set up. Run `/setup` first.');
        return;
      }

      const campaignId = campaignResult.data.id;
      const charsResult = await listCharacters({ id: campaignId }, botRequestOptions());
      const chars = charsResult.status === 'ok' ? charsResult.data : [];

      if (chars.length === 0) {
        await interaction.editReply(
          'No participants registered yet. Use `/participants add @user` to add players.',
        );
        return;
      }

      const lines = chars.map((c) => {
        const gamePart = c.gameName ? `**${c.gameName}**` : '_no game name set_';
        return `• ${gamePart} — ${c.discordName} (\`${c.discordUserId}\`)`;
      });

      await interaction.editReply(`**Participants (${chars.length}):**\n${lines.join('\n')}`);
    }
  } catch (err) {
    console.error('Participants command error:', err);
    // Surface a clear message for the campaign-not-found case
    const message =
      err instanceof Error && err.message.includes('404')
        ? 'This server has no campaign set up yet. Run `/setup` first.'
        : 'Something went wrong. Please try again later.';
    await interaction.editReply(message);
  }
}

export const participantsCommand: BotChatCommand = {
  data: {
    name: 'participants',
    description: 'Manage campaign participants',
    options: [
      {
        name: 'add',
        type: ApplicationCommandOptionType.Subcommand,
        description: 'Add a player as a participant',
        options: [
          {
            name: 'user',
            type: ApplicationCommandOptionType.User,
            description: 'The Discord user to add',
            required: true,
          },
        ],
      },
      {
        name: 'remove',
        type: ApplicationCommandOptionType.Subcommand,
        description: 'Remove a participant from the campaign',
        options: [
          {
            name: 'user',
            type: ApplicationCommandOptionType.User,
            description: 'The Discord user to remove',
            required: true,
          },
        ],
      },
      {
        name: 'list',
        type: ApplicationCommandOptionType.Subcommand,
        description: 'List current campaign participants',
      },
    ],
  },
  execute: handleParticipants,
};
