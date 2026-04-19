import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type GuildMember,
  type InteractionDeferReplyOptions,
} from 'discord.js';
import { setupChannel } from '../api/generated/endpoints/bot/bot.js';
import { syncParticipants } from '../api/participants.js';

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

    const response = await setupChannel(
      {
        guildId,
        guildName,
        discordChannelId,
        channelName,
        campaignName: guildName,
        gameSystemId: 'vtm-v5',
      },
      { headers: { 'x-bot-key': process.env.BOT_API_KEY || '' } },
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
          { headers: { 'x-bot-key': process.env.BOT_API_KEY || '' } },
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
