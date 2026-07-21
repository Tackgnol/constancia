import { describe, expect, it } from 'vitest';
import {
  BLOCK_LABELS,
  BLOCK_TYPES,
  EVENT_TYPES,
  createPipelineBlock,
  defaultBlockConfigs,
  eventFormSchema,
  getDefaultPipelineForEventType,
  getSuggestedBlockTypesForEventType,
  isPipelineEqualToEventDefault,
  normalizeEventFormValues,
  normalizePipelineForSubmission,
  pipelineBlockSchema,
  type EventFormValues,
  type PipelineBlock,
} from '../event-schema.js';

/**
 * Every required string field in a per-block config schema is empty in that block's own default
 * config (a fresh block is meant to start blank and be filled in before the event form can be
 * submitted) so `defaultConfig` never satisfies the schema as authored. Filling every empty string
 * placeholder in-place, without touching array lengths or other structural shape, isolates the
 * *structural* half of "does the default match the schema" from that intentional emptiness.
 */
function fillPlaceholders(value: unknown): unknown {
  if (typeof value === 'string') {
    return value === '' ? 'placeholder' : value;
  }
  if (Array.isArray(value)) {
    return value.map(fillPlaceholders);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        fillPlaceholders(entry),
      ]),
    );
  }
  return value;
}

describe('BLOCK_TYPES / BLOCK_LABELS / defaultBlockConfigs completeness', () => {
  it('gives every block type a non-empty label', () => {
    for (const blockType of BLOCK_TYPES) {
      expect(BLOCK_LABELS[blockType], blockType).toBeTruthy();
    }
  });

  it('gives every block type a default config entry', () => {
    for (const blockType of BLOCK_TYPES) {
      expect(defaultBlockConfigs.has(blockType), blockType).toBe(true);
    }
  });

  it('has no block type outside the catalogue-sourced BLOCK_TYPES list', () => {
    expect(new Set(BLOCK_TYPES).size).toBe(BLOCK_TYPES.length);
  });
});

describe('defaultBlockConfigs vs. per-block config schemas', () => {
  it.each(BLOCK_TYPES)(
    'is structurally accepted by the "%s" schema once placeholder strings are filled in',
    (blockType) => {
      const config = defaultBlockConfigs.get(blockType);
      expect(config, blockType).toBeDefined();

      const result = pipelineBlockSchema.safeParse({
        blockType,
        config: fillPlaceholders(config),
      });

      expect(
        result.success,
        result.success ? undefined : JSON.stringify(result.error?.issues),
      ).toBe(true);
    },
  );

  // Documents, rather than merely assumes, that a freshly-added block's blank config is expected
  // to fail submission validation until the game master fills in the required fields - the same
  // "outcome-map" divergence class the earlier review flagged, proven here for the whole map.
  it('leaves defaultBlockConfigs itself failing validation until required fields are filled in', () => {
    const messagePlayerDefault = defaultBlockConfigs.get('message-player');
    const outcomeMapDefault = defaultBlockConfigs.get('outcome-map');

    expect(
      pipelineBlockSchema.safeParse({ blockType: 'message-player', config: messagePlayerDefault })
        .success,
    ).toBe(false);
    expect(
      pipelineBlockSchema.safeParse({ blockType: 'outcome-map', config: outcomeMapDefault })
        .success,
    ).toBe(false);
  });

  it('gives outcome-map at least one outcome by default, matching the min(1) outcomes requirement', () => {
    const config = defaultBlockConfigs.get('outcome-map') as { outcomes: unknown[] } | undefined;
    expect(config?.outcomes.length).toBeGreaterThanOrEqual(1);
  });
});

describe('createPipelineBlock', () => {
  it('clones the default config rather than sharing a mutable reference', () => {
    const first = createPipelineBlock('message-channel');
    const second = createPipelineBlock('message-channel');

    first.config.content = 'changed';
    expect(second.config.content).not.toBe('changed');
  });
});

describe('getDefaultPipelineForEventType', () => {
  it.each(EVENT_TYPES)('produces only block types drawn from BLOCK_TYPES for "%s"', (eventType) => {
    const pipeline = getDefaultPipelineForEventType(eventType);
    expect(pipeline.length).toBeGreaterThan(0);
    for (const block of pipeline) {
      expect(BLOCK_TYPES, eventType).toContain(block.blockType);
    }
  });
});

describe('getSuggestedBlockTypesForEventType', () => {
  it.each(EVENT_TYPES)('suggests only block types drawn from BLOCK_TYPES for "%s"', (eventType) => {
    for (const blockType of getSuggestedBlockTypesForEventType(eventType)) {
      expect(BLOCK_TYPES, eventType).toContain(blockType);
    }
  });
});

describe('isPipelineEqualToEventDefault', () => {
  it('is true for the untouched default pipeline', () => {
    expect(
      isPipelineEqualToEventDefault('narration', getDefaultPipelineForEventType('narration')),
    ).toBe(true);
  });

  it('is false once a block config has been edited', () => {
    const pipeline = getDefaultPipelineForEventType('narration');
    const edited: PipelineBlock[] = pipeline.map((block) => ({
      ...block,
      config: { ...block.config, content: 'Something happened.' },
    }));

    expect(isPipelineEqualToEventDefault('narration', edited)).toBe(false);
  });

  it('is false when the pipeline is undefined', () => {
    expect(isPipelineEqualToEventDefault('narration', undefined)).toBe(false);
  });
});

describe('normalizePipelineForSubmission', () => {
  it('drops blank and whitespace-only recipient ids from message-player', () => {
    const pipeline: PipelineBlock[] = [
      {
        blockType: 'message-player',
        config: { content: 'Hi', playerIds: ['p1', '  ', '', 'p2'] },
      },
    ];

    const [normalized] = normalizePipelineForSubmission(pipeline, false);
    expect(normalized?.config.playerIds).toEqual(['p1', 'p2']);
  });

  it('normalizes an all-blank recipient list to undefined rather than an empty array', () => {
    const pipeline: PipelineBlock[] = [
      { blockType: 'message-group', config: { content: 'Hi', groupPlayerIds: ['  ', ''] } },
    ];

    const [normalized] = normalizePipelineForSubmission(pipeline, false);
    expect(normalized?.config.groupPlayerIds).toBeUndefined();
  });

  it('syncs shortCircuit onto every outcome-map block from the event-level flag', () => {
    const pipeline: PipelineBlock[] = [
      { blockType: 'outcome-map', config: { outcomes: [{ threshold: 0, text: 'x' }] } },
    ];

    const [normalized] = normalizePipelineForSubmission(pipeline, true);
    expect(normalized?.config.shortCircuit).toBe(true);
  });

  it('leaves block types without a normalizer untouched', () => {
    const pipeline: PipelineBlock[] = [
      { blockType: 'display-image', config: { imageUrl: 'https://example.test/a.png' } },
    ];

    const [normalized] = normalizePipelineForSubmission(pipeline, false);
    expect(normalized).toEqual(pipeline[0]);
  });
});

describe('normalizeEventFormValues', () => {
  it('runs normalizePipelineForSubmission over the pipeline field', () => {
    const values: EventFormValues = {
      name: 'Ambush',
      type: 'message',
      channelId: 'channel-1',
      shortCircuit: false,
      pipeline: [{ blockType: 'message-player', config: { content: 'Hi', playerIds: ['  '] } }],
    };

    const normalized = normalizeEventFormValues(values);
    expect(normalized.pipeline[0]?.config.playerIds).toBeUndefined();
  });
});

describe('eventFormSchema', () => {
  it('accepts a fully filled-in event form', () => {
    const values: EventFormValues = {
      name: 'Ambush',
      type: 'message',
      channelId: 'channel-1',
      shortCircuit: false,
      pipeline: [{ blockType: 'message-player', config: { content: 'Hi' } }],
    };

    expect(eventFormSchema.safeParse(values).success).toBe(true);
  });

  it('rejects a pipeline with no blocks', () => {
    const values: EventFormValues = {
      name: 'Ambush',
      type: 'message',
      channelId: 'channel-1',
      shortCircuit: false,
      pipeline: [],
    };

    expect(eventFormSchema.safeParse(values).success).toBe(false);
  });

  it('surfaces a per-block config error at the pipeline path', () => {
    const values: EventFormValues = {
      name: 'Ambush',
      type: 'message',
      channelId: 'channel-1',
      shortCircuit: false,
      pipeline: [{ blockType: 'message-player', config: { content: '' } }],
    };

    const result = eventFormSchema.safeParse(values);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['pipeline', 0, 'config', 'content']);
    }
  });
});
