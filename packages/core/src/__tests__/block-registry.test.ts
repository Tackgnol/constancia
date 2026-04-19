import { describe, it, expect } from 'vitest';
import { BlockRegistry } from '../block-registry.js';
import type { BlockDefinition } from '@constancia/contracts';

const mockBlock: BlockDefinition<{ message: string }> = {
  type: 'test-block',
  label: 'Test Block',
  configSchema: { type: 'object' },
  execute: async (config: { message: string }) => ({
    output: config.message,
    messages: [],
  }),
};

describe('BlockRegistry', () => {
  it('registers and retrieves a block by type', () => {
    const registry = new BlockRegistry();
    registry.register(mockBlock);
    const found = registry.get('test-block');
    expect(found).toBe(mockBlock);
  });

  it('returns undefined for unknown block type', () => {
    const registry = new BlockRegistry();
    const found = registry.get('nonexistent');
    expect(found).toBeUndefined();
  });

  it('lists all registered block types', () => {
    const registry = new BlockRegistry();
    registry.register(mockBlock);
    registry.register({ ...mockBlock, type: 'another-block', label: 'Another' });
    expect(registry.listTypes()).toEqual(['test-block', 'another-block']);
  });

  it('throws on duplicate registration', () => {
    const registry = new BlockRegistry();
    registry.register(mockBlock);
    expect(() => registry.register(mockBlock)).toThrow('already registered');
  });
});
