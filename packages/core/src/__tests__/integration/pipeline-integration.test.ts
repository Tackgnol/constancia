import { describe, it, expect } from 'vitest';
import { BlockRegistry } from '../../block-registry.js';
import { BlockConfigValidationError, PipelineRunner } from '../../pipeline-runner.js';
import { outcomeMapBlock } from '../../blocks/outcome-map.js';
import { conditionalGateBlock } from '../../blocks/conditional-gate.js';
import { messagePlayerBlock } from '../../blocks/message-player.js';
import { messageChannelBlock } from '../../blocks/message-channel.js';
import { displayImageBlock } from '../../blocks/display-image.js';
import type { BlockContext, BlockInstance } from '@constancia/contracts';

function createRegistry(): BlockRegistry {
  const registry = new BlockRegistry();
  registry.register(outcomeMapBlock);
  registry.register(conditionalGateBlock);
  registry.register(messagePlayerBlock);
  registry.register(messageChannelBlock);
  registry.register(displayImageBlock);
  return registry;
}

describe('Pipeline Integration', () => {
  it('VTM-style test event: score -> outcome -> message player', async () => {
    const registry = createRegistry();
    const runner = new PipelineRunner(registry);

    const pipeline: BlockInstance[] = [
      {
        blockType: 'outcome-map',
        config: {
          outcomes: [
            { minScore: 0, maxScore: 0, text: 'You notice nothing unusual.' },
            { minScore: 1, maxScore: 2, text: 'Something moves in the shadows...' },
            {
              minScore: 3,
              maxScore: 10,
              text: 'You spot the Nosferatu hiding behind the pillar.',
            },
          ],
          shortCircuit: true,
        },
      },
      {
        blockType: 'message-player',
        config: { content: 'Test complete.' },
      },
    ];

    const ctx: BlockContext = {
      campaignId: 'c1',
      channelId: 'ch1',
      playerId: 'p1',
      playerScore: 3,
      characterData: {},
    };

    const result = await runner.run(pipeline, ctx);
    expect(result.halted).toBe(false);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].content).toBe('You spot the Nosferatu hiding behind the pillar.');
    expect(result.messages[1].content).toBe('Test complete.');
  });

  it('Stat insight event: gate passes -> message player', async () => {
    const registry = createRegistry();
    const runner = new PipelineRunner(registry);

    const pipeline: BlockInstance[] = [
      {
        blockType: 'conditional-gate',
        config: { statPath: 'occult', operator: 'gte', threshold: 4 },
      },
      {
        blockType: 'message-player',
        config: { content: 'The sigil is Tremere - old clan markings.' },
      },
    ];

    const ctx: BlockContext = {
      campaignId: 'c1',
      channelId: 'ch1',
      playerId: 'p1',
      characterData: { occult: 4 },
    };

    const result = await runner.run(pipeline, ctx);
    expect(result.halted).toBe(false);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toContain('Tremere');
  });

  it('Stat insight event: gate fails -> halts pipeline', async () => {
    const registry = createRegistry();
    const runner = new PipelineRunner(registry);

    const pipeline: BlockInstance[] = [
      {
        blockType: 'conditional-gate',
        config: { statPath: 'occult', operator: 'gte', threshold: 4 },
      },
      {
        blockType: 'message-player',
        config: { content: 'Should not see this.' },
      },
    ];

    const ctx: BlockContext = {
      campaignId: 'c1',
      channelId: 'ch1',
      playerId: 'p1',
      characterData: { occult: 2 },
    };

    const result = await runner.run(pipeline, ctx);
    expect(result.halted).toBe(true);
    expect(result.messages).toHaveLength(0);
  });

  it('Narration event: image + channel message', async () => {
    const registry = createRegistry();
    const runner = new PipelineRunner(registry);

    const pipeline: BlockInstance[] = [
      {
        blockType: 'display-image',
        config: { imageUrl: 'https://img.com/dark-alley.jpg', caption: '' },
      },
      {
        blockType: 'message-channel',
        config: { content: 'The alley reeks of blood and old stone.' },
      },
    ];

    const ctx: BlockContext = {
      campaignId: 'c1',
      channelId: 'ch1',
      playerId: 'p1',
      characterData: {},
    };

    const result = await runner.run(pipeline, ctx);
    expect(result.halted).toBe(false);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].imageUrl).toBe('https://img.com/dark-alley.jpg');
    expect(result.messages[1].content).toContain('alley reeks');
    expect(result.messages[1].target).toBe('channel');
  });

  it('fails fast on invalid nested outcome-map config', async () => {
    const registry = createRegistry();
    const runner = new PipelineRunner(registry);

    const pipeline: BlockInstance[] = [
      {
        blockType: 'outcome-map',
        config: {
          outcomes: [{ minScore: 0, maxScore: 1 }],
        },
      },
      {
        blockType: 'message-player',
        config: { content: 'Should never run.' },
      },
    ];

    const ctx: BlockContext = {
      campaignId: 'c1',
      channelId: 'ch1',
      playerId: 'p1',
      playerScore: 1,
      characterData: {},
    };

    await expect(runner.run(pipeline, ctx)).rejects.toThrow(BlockConfigValidationError);
    await expect(runner.run(pipeline, ctx)).rejects.toThrow(
      'Invalid config for block "outcome-map"',
    );
  });
});
