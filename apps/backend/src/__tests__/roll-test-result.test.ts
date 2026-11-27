import { describe, expect, it } from 'vitest';
import { PipelineRunner } from '@constancia/core';
import { buildBlockRegistry } from '../blocks.js';
import { EventExecutionRequestError } from '../services/event-execution.js';
import { rollTestResult } from '../services/test-instance.js';

const ctx = {
  campaignId: 'campaign-1',
  channelId: 'channel-1',
  playerId: 'discord-player-1',
  characterData: { attributes: { dexterity: 3 }, skills: { stealth: 2 } },
};

describe('rollTestResult', () => {
  it("rolls with the system's test-resolver and keeps only the private breakdown", async () => {
    const roll = await rollTestResult(
      new PipelineRunner(buildBlockRegistry('vtm-v5')),
      [
        { blockType: 'test-resolver', config: { attribute: 'dexterity', skill: 'stealth' } },
        {
          blockType: 'outcome-map',
          config: { outcomes: [{ threshold: 0, text: 'You slip by.' }] },
        },
      ],
      ctx,
    );

    expect(roll.playerScore).toBeGreaterThanOrEqual(0);
    expect(roll.breakdown).toHaveLength(1);
    expect(roll.breakdown[0]).toContain('🎲');
    expect(roll.breakdown.join(' ')).not.toContain('You slip by.');
  });

  it('refuses to roll a Test without a resolver', async () => {
    await expect(
      rollTestResult(
        new PipelineRunner(buildBlockRegistry('vtm-v5')),
        [{ blockType: 'outcome-map', config: { outcomes: [{ threshold: 0, text: 'x' }] } }],
        ctx,
      ),
    ).rejects.toBeInstanceOf(EventExecutionRequestError);
  });

  it('passes a roll-modifier to the 5E resolver so advantage rolls two dice', async () => {
    const roll = await rollTestResult(
      new PipelineRunner(buildBlockRegistry('5e-srd')),
      [
        { blockType: 'roll-modifier', config: { mode: 'advantage' } },
        { blockType: 'test-resolver', config: { mode: 'check', ability: 'dex' } },
      ],
      { ...ctx, characterData: { abilities: { dex: 14 } } },
    );

    expect(roll.breakdown[0]).toMatch(/^🎲 d20 \[\d+, \d+\] advantage \+2 DEX = \d+$/);
  });
});
