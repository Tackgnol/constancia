import {
  ApplicationCommandOptionType,
  MessageFlags,
  type ChatInputCommandInteraction,
  type GuildMember,
  type InteractionDeferReplyOptions,
} from 'discord.js';
import { botBackend, type BotBackend } from '../backend/bot-backend.js';
import { BotAccessRevokedError } from '../backend/access-revoked.js';
import type { BotChatCommand } from '../discord/command-types.js';

export async function handleParticipants(
  interaction: ChatInputCommandInteraction,
  backend: BotBackend = botBackend,
): Promise<void> {
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

      await backend.syncParticipants(guildId, [{ discordUserId: user.id, discordName }]);
      await interaction.editReply(
        `✓ **${discordName}** added as a participant.\nGM can set their in-game name on the dashboard.`,
      );
    } else if (sub === 'remove') {
      const user = interaction.options.getUser('user', true);

      const deleted = await backend.removeParticipant(guildId, user.id);

      if (deleted) {
        await interaction.editReply(`✓ **${user.username}** removed from the campaign.`);
      } else {
        await interaction.editReply(`${user.username} is not a registered participant.`);
      }
    } else if (sub === 'list') {
      const campaign = await backend.getCampaign(guildId);
      if (!campaign) {
        await interaction.editReply('This server has no campaign set up. Run `/setup` first.');
        return;
      }
      const chars = await backend.listParticipants(campaign.id);

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
    if (err instanceof BotAccessRevokedError) throw err;
    console.error('Participants command error:', err);
    await interaction.editReply('Something went wrong. Please try again later.');
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
