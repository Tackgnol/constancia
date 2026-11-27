import { describe, expect, it } from 'vitest';
import { buildBlockRegistry, findPipelineError } from '../blocks.js';

describe('per-campaign block registry', () => {
  it('registers role blocks only for systems that implement them', () => {
    expect(buildBlockRegistry('vtm-v5').get('test-resolver')).toBeDefined();
    expect(buildBlockRegistry('vtm-v5').get('insight-resolver')).toBeDefined();
    expect(buildBlockRegistry('mork-borg').get('test-resolver')).toBeUndefined();
    expect(buildBlockRegistry('mork-borg').get('message-channel')).toBeDefined();
  });

  it("validates role block config against the campaign system's schema", () => {
    expect(
      findPipelineError('vtm-v5', [
        { blockType: 'test-resolver', config: { attribute: 'wits', skill: 'awareness' } },
      ]),
    ).toBeNull();
    expect(
      findPipelineError('vtm-v5', [{ blockType: 'test-resolver', config: { attribute: 'wits' } }]),
    ).toMatch(/Invalid config for block "test-resolver"/);
  });

  it('rejects role blocks the campaign system does not implement', () => {
    expect(findPipelineError('mork-borg', [{ blockType: 'insight-resolver', config: {} }])).toBe(
      'This Game System does not support "insight-resolver".',
    );
    expect(findPipelineError('mork-borg', [{ blockType: 'nope', config: {} }])).toMatch(
      /Unknown block type/,
    );
  });

  it('validates 5E test config: no skill on saves, any skill with any ability', () => {
    const pipeline = (config: Record<string, unknown>) => [{ blockType: 'test-resolver', config }];

    expect(findPipelineError('5e-srd', pipeline({ mode: 'save', ability: 'dex' }))).toBeNull();
    expect(
      findPipelineError('5e-srd', pipeline({ mode: 'check', ability: 'cha', skill: 'stealth' })),
    ).toBeNull();
    expect(
      findPipelineError('5e-srd', pipeline({ mode: 'save', ability: 'dex', skill: 'stealth' })),
    ).toMatch(/Invalid config/);
  });
});
