import { describe, expect, it, vi } from 'vitest';
import { createInMemoryBotBackend } from '../backend/bot-backend.js';
import { BotCampaignAdminRequiredError } from '../backend/access-revoked.js';
import { handleParticipants } from '../commands/participants.js';

describe('/participants list', () => {
  it('keeps the setup guidance when the backend cannot resolve a campaign', async () => {
    const interaction = {
      guildId: 'guild-1',
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      options: {
        getSubcommand: vi.fn().mockReturnValue('list'),
      },
    };
    const backend = createInMemoryBotBackend({
      getCampaign: vi.fn().mockResolvedValue(null),
    });

    await handleParticipants(interaction as never, backend);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'This server has no campaign set up. Run `/setup` first.',
    );
  });
});

describe('/participants add authorization', () => {
  it('surfaces the GM-required message instead of a generic failure', async () => {
    const interaction = {
      guildId: 'guild-1',
      user: { id: 'discord-outsider' },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      options: {
        getSubcommand: vi.fn().mockReturnValue('add'),
        getUser: vi
          .fn()
          .mockReturnValue({ id: 'discord-player', displayName: 'Player', username: 'player' }),
        getMember: vi.fn().mockReturnValue(null),
      },
    };
    const backend = createInMemoryBotBackend({
      syncParticipants: vi
        .fn()
        .mockRejectedValue(new BotCampaignAdminRequiredError("You're not a GM for this campaign.")),
    });

    await handleParticipants(interaction as never, backend);

    expect(interaction.editReply).toHaveBeenCalledWith("You're not a GM for this campaign.");
  });
});
