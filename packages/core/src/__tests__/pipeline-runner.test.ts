import { describe, it, expect, vi } from 'vitest';
import { PipelineRunner } from '../pipeline-runner.js';
import { BlockRegistry } from '../block-registry.js';
import type { BlockDefinition, BlockContext, BlockInstance } from '@constancia/contracts';

function createContext(overrides?: Partial<BlockContext>): BlockContext {
  return {
    campaignId: 'campaign-1',
    channelId: 'channel-1',
    playerId: 'player-1',
    characterData: {},
    ...overrides,
  };
}

describe('PipelineRunner', () => {
  it('executes blocks in order and collects messages', async () => {
    const registry = new BlockRegistry();

    const block1: BlockDefinition<{ text: string }> = {
      type: 'say',
      label: 'Say',
      configSchema: { type: 'object' },
      execute: async (config) => ({
        output: config.text,
        messages: [{ target: 'player' as const, content: config.text }],
      }),
    };

    registry.register(block1);

    const runner = new PipelineRunner(registry);
    const blocks: BlockInstance[] = [
      { blockType: 'say', config: { text: 'Hello' } },
      { blockType: 'say', config: { text: 'World' } },
    ];

    const result = await runner.run(blocks, createContext());
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].content).toBe('Hello');
    expect(result.messages[1].content).toBe('World');
  });

  it('halts pipeline when a block sets halt: true', async () => {
    const registry = new BlockRegistry();

    const gateBlock: BlockDefinition<{ pass: boolean }> = {
      type: 'gate',
      label: 'Gate',
      configSchema: { type: 'object' },
      execute: async (config) => ({
        output: null,
        halt: !config.pass,
      }),
    };

    const sayBlock: BlockDefinition<{ text: string }> = {
      type: 'say',
      label: 'Say',
      configSchema: { type: 'object' },
      execute: async (config) => ({
        output: config.text,
        messages: [{ target: 'player' as const, content: config.text }],
      }),
    };

    registry.register(gateBlock);
    registry.register(sayBlock);

    const runner = new PipelineRunner(registry);
    const blocks: BlockInstance[] = [
      { blockType: 'gate', config: { pass: false } },
      { blockType: 'say', config: { text: 'Should not appear' } },
    ];

    const result = await runner.run(blocks, createContext());
    expect(result.messages).toHaveLength(0);
    expect(result.halted).toBe(true);
  });

  it('throws on unknown block type', async () => {
    const registry = new BlockRegistry();
    const runner = new PipelineRunner(registry);
    const blocks: BlockInstance[] = [{ blockType: 'nonexistent', config: {} }];

    await expect(runner.run(blocks, createContext())).rejects.toThrow(
      'Unknown block type: "nonexistent"',
    );
  });

  it('passes context through to blocks', async () => {
    const registry = new BlockRegistry();
    const executeSpy = vi.fn(async () => ({ output: null }));

    const block: BlockDefinition = {
      type: 'spy',
      label: 'Spy',
      configSchema: { type: 'object' },
      execute: executeSpy,
    };

    registry.register(block);

    const runner = new PipelineRunner(registry);
    const ctx = createContext({ playerScore: 5 });

    await runner.run([{ blockType: 'spy', config: { key: 'val' } }], ctx);

    expect(executeSpy).toHaveBeenCalledWith({ key: 'val' }, ctx);
  });
});
