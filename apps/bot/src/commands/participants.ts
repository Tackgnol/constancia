import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type GuildMember,
  type InteractionDeferReplyOptions,
} from 'discord.js';
import { getCampaignByGuild } from '../api/generated/endpoints/bot/bot.js';
import { syncParticipants, removeParticipant } from '../api/participants.js';
import { listCharacters } from '../api/generated/endpoints/characters/characters.js';

function buildHeaders(): RequestInit {
  return { headers: { 'x-bot-key': process.env.BOT_API_KEY ?? '' } };
}

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
        buildHeaders(),
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

      const result = await removeParticipant({ guildId, discordUserId: user.id }, buildHeaders());

      if (result.deleted) {
        await interaction.editReply(`✓ **${user.username}** removed from the campaign.`);
      } else {
        await interaction.editReply(`${user.username} is not a registered participant.`);
      }
    } else if (sub === 'list') {
      const campaignResult = await getCampaignByGuild({ guildId }, buildHeaders());
      if (campaignResult.status !== 'ok') {
        await interaction.editReply('This server has no campaign set up. Run `/setup` first.');
        return;
      }

      const campaignId = campaignResult.data.id;
      const charsResult = await listCharacters({ id: campaignId }, buildHeaders());
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
