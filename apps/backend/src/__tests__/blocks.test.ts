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
      findPipelineError(
        'vtm-v5',
        [{ blockType: 'test-resolver', config: { attribute: 'wits', skill: 'awareness' } }],
        'test',
      ),
    ).toBeNull();
    expect(
      findPipelineError(
        'vtm-v5',
        [{ blockType: 'test-resolver', config: { attribute: 'wits' } }],
        'test',
      ),
    ).toMatch(/Invalid config for block "test-resolver"/);
  });

  it('rejects role blocks the campaign system does not implement', () => {
    expect(
      findPipelineError('mork-borg', [{ blockType: 'insight-resolver', config: {} }], 'narration'),
    ).toBe('This Game System does not support "insight-resolver".');
    expect(
      findPipelineError('mork-borg', [{ blockType: 'nope', config: {} }], 'narration'),
    ).toMatch(/Unknown block type/);
  });

  it("rejects Event types whose role the campaign system doesn't implement", () => {
    const outcomeOnly = [{ blockType: 'outcome-map', config: { comparison: 'gte', outcomes: [] } }];

    expect(findPipelineError('mork-borg', outcomeOnly, 'test')).toBe(
      'This Game System does not support test Events.',
    );
    expect(findPipelineError('mork-borg', [], 'insight')).toBe(
      'This Game System does not support insight Events.',
    );
    expect(findPipelineError('mork-borg', [], 'narration')).toBeNull();
    expect(findPipelineError('vtm-v5', [], 'test')).toBeNull();
  });

  it('validates 5E test config: no skill on saves, any skill with any ability', () => {
    const pipeline = (config: Record<string, unknown>) => [{ blockType: 'test-resolver', config }];

    expect(
      findPipelineError('5e-srd', pipeline({ mode: 'save', ability: 'dex' }), 'test'),
    ).toBeNull();
    expect(
      findPipelineError(
        '5e-srd',
        pipeline({ mode: 'check', ability: 'cha', skill: 'stealth' }),
        'test',
      ),
    ).toBeNull();
    expect(
      findPipelineError(
        '5e-srd',
        pipeline({ mode: 'save', ability: 'dex', skill: 'stealth' }),
        'test',
      ),
    ).toMatch(/Invalid config/);
  });

  it('requires every roll-modifier before test-resolver and hides it from VTM', () => {
    const modifier = { blockType: 'roll-modifier', config: { mode: 'advantage' } };
    const resolver = { blockType: 'test-resolver', config: { mode: 'check', ability: 'dex' } };
    const ordering = /before the test resolver/;

    expect(findPipelineError('5e-srd', [modifier, resolver], 'test')).toBeNull();
    expect(findPipelineError('5e-srd', [modifier, modifier, resolver], 'test')).toBeNull();
    expect(findPipelineError('5e-srd', [resolver, modifier], 'test')).toMatch(ordering);
    expect(findPipelineError('5e-srd', [modifier, resolver, modifier], 'test')).toMatch(ordering);
    expect(findPipelineError('vtm-v5', [modifier], 'narration')).toBe(
      'This Game System does not support "roll-modifier".',
    );
  });
});
