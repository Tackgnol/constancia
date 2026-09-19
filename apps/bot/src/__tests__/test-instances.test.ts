import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModalSubmitInteraction } from 'discord.js';
import { botBackend } from '../backend/bot-backend.js';
import {
  decodeTestInstanceId,
  testInstanceFooter,
  testInstanceModalHandler,
} from '../discord/test-instances.js';

const receipt = { deliveries: [], submittedCount: 3 };

function modalInteraction(overrides: { fromMessage: boolean; edit?: ReturnType<typeof vi.fn> }) {
  const edit = overrides.edit ?? vi.fn(async () => undefined);
  const interaction = {
    customId: 'test-instance:modal:instance-1',
    id: 'interaction-1',
    channelId: 'channel-1',
    user: { id: 'player-1' },
    fields: { getTextInputValue: () => '4' },
    deferReply: vi.fn(async () => undefined),
    editReply: vi.fn(async () => undefined),
    isFromMessage: () => overrides.fromMessage,
    message: { embeds: [{ title: 'Stealth', footer: { text: 'old' } }], edit },
  };
  return { interaction, edit };
}

async function submit(interaction: ReturnType<typeof modalInteraction>['interaction']) {
  await testInstanceModalHandler.execute(interaction as unknown as ModalSubmitInteraction);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('decodeTestInstanceId', () => {
  it('extracts the instance id and rejects malformed ids', () => {
    expect(decodeTestInstanceId('test-instance:submit:abc', 'test-instance:submit:')).toBe('abc');
    expect(decodeTestInstanceId('test-instance:submit:', 'test-instance:submit:')).toBeNull();
    expect(decodeTestInstanceId('test-instance:submit:a:b', 'test-instance:submit:')).toBeNull();
    expect(decodeTestInstanceId('other:abc', 'test-instance:submit:')).toBeNull();
  });
});

describe('testInstanceFooter', () => {
  it('adds only a count, never names or scores', () => {
    expect(testInstanceFooter()).toBe('Submit your actual result. The bot does not roll for you.');
    expect(testInstanceFooter(3)).toBe(
      '3 submitted · Submit your actual result. The bot does not roll for you.',
    );
  });
});

describe('testInstanceModalHandler', () => {
  it('submits against the instance id and refreshes the public count', async () => {
    const submitTestResult = vi
      .spyOn(botBackend, 'submitTestResult')
      .mockResolvedValue(receipt as never);
    const { interaction, edit } = modalInteraction({ fromMessage: true });

    await submit(interaction);

    expect(submitTestResult).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      discordUserId: 'player-1',
      discordChannelId: 'channel-1',
      playerScore: 4,
      idempotencyKey: 'interaction-1',
    });
    expect(edit).toHaveBeenCalledTimes(1);
    expect(edit.mock.calls[0]?.[0].embeds[0].data.footer.text).toBe(testInstanceFooter(3));
    expect(interaction.editReply).toHaveBeenCalledWith('Result submitted.');
  });

  it('still confirms the submission when the card edit fails', async () => {
    vi.spyOn(botBackend, 'submitTestResult').mockResolvedValue(receipt as never);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { interaction } = modalInteraction({
      fromMessage: true,
      edit: vi.fn(async () => {
        throw new Error('Missing Access');
      }),
    });

    await submit(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith('Result submitted.');
  });

  it('leaves the card alone when the modal was not opened from the card', async () => {
    vi.spyOn(botBackend, 'submitTestResult').mockResolvedValue(receipt as never);
    const { interaction, edit } = modalInteraction({ fromMessage: false });

    await submit(interaction);

    expect(edit).not.toHaveBeenCalled();
  });
});
