import { describe, expect, it, vi } from 'vitest';
import { createInMemoryBotBackend } from '../backend/bot-backend.js';
import { handleDate } from '../commands/date.js';

function createInteraction(guildId: string | null = 'guild-1') {
  return {
    guildId,
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  };
}

describe('/date', () => {
  it('renders the backend-formatted campaign date without game-system logic', async () => {
    const interaction = createInteraction();
    const backend = createInMemoryBotBackend({
      getCampaignDate: vi.fn().mockResolvedValue('17 July 2026'),
    });

    await handleDate(interaction as never, backend);

    expect(interaction.editReply).toHaveBeenCalledWith('📅 Current game date: **17 July 2026**');
  });

  it('distinguishes an unset date from an unconfigured server', async () => {
    const noDateInteraction = createInteraction();
    await handleDate(
      noDateInteraction as never,
      createInMemoryBotBackend({ getCampaignDate: async () => null }),
    );
    expect(noDateInteraction.editReply).toHaveBeenCalledWith(
      'No game date set yet. The GM can set one from the War Room top bar.',
    );

    const noCampaignInteraction = createInteraction();
    await handleDate(
      noCampaignInteraction as never,
      createInMemoryBotBackend({ getCampaignDate: async () => undefined }),
    );
    expect(noCampaignInteraction.editReply).toHaveBeenCalledWith(
      'This server has no campaign set up. Run `/setup` first.',
    );
  });
});
