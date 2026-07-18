import { describe, expect, it, vi } from 'vitest';
import { createInMemoryBotBackend } from '../backend/bot-backend.js';
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
