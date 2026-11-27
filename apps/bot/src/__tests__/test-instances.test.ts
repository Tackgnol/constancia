import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModalSubmitInteraction } from 'discord.js';
import { botBackend } from '../backend/bot-backend.js';
import type { MessageComponentInteraction } from 'discord.js';
import {
  clearHintCache,
  decodeTestInstanceId,
  getHintWithinBudget,
  modalHintText,
  testInstanceFooter,
  testInstanceModalHandler,
  testInstanceRollHandler,
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
  clearHintCache();
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
    expect(testInstanceFooter()).toBe('Enter your final result, or let the bot roll for you.');
    expect(testInstanceFooter(3)).toBe(
      '3 submitted · Enter your final result, or let the bot roll for you.',
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

describe('testInstanceRollHandler', () => {
  it('asks the backend to roll and replies privately with the dice', async () => {
    const submitTestResult = vi.spyOn(botBackend, 'submitTestResult').mockResolvedValue({
      ...receipt,
      roll: { playerScore: 2, breakdown: ['🎲 Pool: 4 dice → Success'] },
    } as never);
    const edit = vi.fn(async () => undefined);
    const interaction = {
      customId: 'test-instance:roll:instance-1',
      id: 'interaction-2',
      channelId: 'channel-1',
      user: { id: 'player-1' },
      deferReply: vi.fn(async () => undefined),
      editReply: vi.fn(async () => undefined),
      showModal: vi.fn(),
      message: { embeds: [{ title: 'Stealth', footer: { text: 'old' } }], edit },
    };

    await testInstanceRollHandler.execute(interaction as unknown as MessageComponentInteraction);

    expect(interaction.showModal).not.toHaveBeenCalled();
    expect(submitTestResult).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      discordUserId: 'player-1',
      discordChannelId: 'channel-1',
      rollForMe: true,
      idempotencyKey: 'interaction-2',
    });
    expect(edit).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalledWith(
      ['🎲 Pool: 4 dice → Success', 'Result submitted.'].join(String.fromCharCode(10)),
    );
  });
});

describe('modal hint', () => {
  it('prefixes the Game System hint, or falls back to the plain instruction', () => {
    expect(modalHintText('Your pool: **6 dice**.')).toBe(
      'Your pool: **6 dice**. Consult your character sheet; enter your final result.',
    );
    expect(modalHintText(null)).toBe('Consult your character sheet; enter your final result.');
    expect(modalHintText(undefined)).toBe('Consult your character sheet; enter your final result.');
  });

  it('caches a hint per player and instance', async () => {
    const getTestHint = vi
      .spyOn(botBackend, 'getTestHint')
      .mockResolvedValue('Your pool: **6 dice**.');

    expect(await getHintWithinBudget('instance-1', 'player-1')).toBe('Your pool: **6 dice**.');
    expect(await getHintWithinBudget('instance-1', 'player-1')).toBe('Your pool: **6 dice**.');
    expect(getTestHint).toHaveBeenCalledTimes(1);
  });

  it('gives up on a slow backend so the modal still opens in time', async () => {
    vi.spyOn(botBackend, 'getTestHint').mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('late'), 50)),
    );

    expect(await getHintWithinBudget('instance-2', 'player-1', 5)).toBeUndefined();
  });
});
