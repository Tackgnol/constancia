import { Ajv } from 'ajv';
import { describe, expect, it } from 'vitest';
import {
  PIPELINE_BLOCK_SPECS,
  createDefaultPipelineBlock,
  listPipelineBlockSpecs,
  requirePipelineBlockSpec,
} from '../index.js';

describe('pipeline block catalogue contract', () => {
  it('has one unique descriptor for every pipeline block type', () => {
    const blockTypes = PIPELINE_BLOCK_SPECS.map((spec) => spec.blockType);
    expect(new Set(blockTypes).size).toBe(blockTypes.length);
  });

  it('provides a default config accepted by every config schema', () => {
    const ajv = new Ajv({ allErrors: true });

    for (const spec of PIPELINE_BLOCK_SPECS) {
      const validate = ajv.compile(spec.configSchema);
      expect(
        validate(spec.defaultConfig),
        `${spec.blockType}: ${ajv.errorsText(validate.errors)}`,
      ).toBe(true);
    }
  });

  it('exposes role blocks only to systems that implement the role', () => {
    const vtmTypes = listPipelineBlockSpecs(['test-resolver', 'insight-resolver']).map(
      (spec) => spec.blockType,
    );
    const morkBorgTypes = listPipelineBlockSpecs([]).map((spec) => spec.blockType);

    expect(vtmTypes).toContain('test-resolver');
    expect(vtmTypes).toContain('insight-resolver');
    expect(morkBorgTypes).not.toContain('test-resolver');
    expect(morkBorgTypes).not.toContain('insight-resolver');
    expect(morkBorgTypes).toContain('message-channel');
    expect(morkBorgTypes).toContain('add-journal-entry');
  });

  it('clones default configs instead of sharing mutable editor state', () => {
    const first = createDefaultPipelineBlock('message-channel');
    const second = createDefaultPipelineBlock('message-channel');

    first.config.content = 'changed';
    expect(second.config).toEqual(requirePipelineBlockSpec('message-channel').defaultConfig);
  });
});
