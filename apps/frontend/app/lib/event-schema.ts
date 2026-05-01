import { z } from 'zod';

// ── Per-block config schemas ──────────────────────────────────────────────────

function normalizeRecipientIds(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const ids = value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);

    return ids.length > 0 ? ids : undefined;
  }

  return undefined;
}

const recipientIdsSchema = z.preprocess(normalizeRecipientIds, z.array(z.string()).optional());

// Used by message-player only
export const messagePlayerConfigSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  imageUrl: z.string().optional(),
  playerIds: recipientIdsSchema,
});

// Used by message-channel
export const messageContentConfigSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  imageUrl: z.string().optional(),
});

export const messageGroupConfigSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  imageUrl: z.string().optional(),
  groupPlayerIds: recipientIdsSchema,
});

export const displayImageConfigSchema = z.object({
  imageUrl: z.string().min(1, 'Image URL is required'),
  caption: z.string().optional(),
});

export const conditionalGateConfigSchema = z.object({
  statPath: z.string().min(1, 'Stat path is required'),
  operator: z.enum(['gte', 'gt', 'lte', 'lt', 'eq']),
  threshold: z.coerce.number(),
});

export const outcomeEntrySchema = z.object({
  threshold: z.coerce.number(),
  text: z.string().min(1, 'Text is required'),
});

export const outcomeMapConfigSchema = z.object({
  outcomes: z.array(outcomeEntrySchema).min(1, 'Add at least one outcome'),
  shortCircuit: z.boolean().optional(),
});

export const retrieveDataConfigSchema = z.object({
  dataType: z.string().min(1, 'Data type is required'),
  query: z.record(z.string(), z.unknown()).optional(),
});

export const vtmPoolResolverConfigSchema = z.object({
  attribute: z.string().min(1, 'Attribute key is required'),
  skill: z.string().min(1, 'Skill key is required'),
});

export const vtmInsightResolverConfigSchema = z.object({
  attribute: z.string().min(1, 'Attribute key is required'),
  skill: z.string().min(1, 'Skill key is required'),
});

// ── Block types ───────────────────────────────────────────────────────────────

export const BLOCK_TYPES = [
  'message-player',
  'message-channel',
  'message-group',
  'display-image',
  'conditional-gate',
  'outcome-map',
  'retrieve-data',
  'vtm-pool-resolver',
  'vtm-insight-resolver',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];
export const EVENT_TYPES = ['test', 'narration', 'insight', 'message'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const BLOCK_LABELS: Record<BlockType, string> = {
  'message-player': 'Message Player',
  'message-channel': 'Message Channel',
  'message-group': 'Message Group',
  'display-image': 'Display Image',
  'conditional-gate': 'Conditional Gate',
  'outcome-map': 'Outcome Map',
  'retrieve-data': 'Retrieve Data',
  'vtm-pool-resolver': 'VTM V5 Dice Pool Resolver',
  'vtm-insight-resolver': 'VTM V5 Insight Resolver',
};

export const defaultBlockConfigs: Record<BlockType, Record<string, unknown>> = {
  'message-player': { content: '', imageUrl: '', playerIds: [] },
  'message-channel': { content: '', imageUrl: '' },
  'message-group': { content: '', imageUrl: '', groupPlayerIds: [] },
  'display-image': { imageUrl: '', caption: '' },
  'conditional-gate': { statPath: '', operator: 'gte', threshold: 1 },
  'outcome-map': { outcomes: [{ threshold: 0, text: '' }], shortCircuit: true },
  'retrieve-data': { dataType: '', query: {} },
  'vtm-pool-resolver': { attribute: '', skill: '' },
  'vtm-insight-resolver': { attribute: '', skill: '' },
};

const DEFAULT_PIPELINE_BLOCKS_BY_EVENT_TYPE: Record<EventType, readonly BlockType[]> = {
  test: ['vtm-pool-resolver', 'outcome-map'],
  narration: ['message-channel'],
  insight: ['vtm-insight-resolver', 'outcome-map'],
  message: ['message-player'],
};

const SUGGESTED_BLOCK_TYPES_BY_EVENT_TYPE: Record<EventType, readonly BlockType[]> = {
  test: [
    'vtm-pool-resolver',
    'outcome-map',
    'conditional-gate',
    'message-player',
    'message-channel',
    'display-image',
    'retrieve-data',
    'message-group',
  ],
  narration: [
    'message-channel',
    'display-image',
    'message-player',
    'message-group',
    'conditional-gate',
    'retrieve-data',
    'outcome-map',
    'vtm-pool-resolver',
  ],
  insight: [
    'vtm-insight-resolver',
    'outcome-map',
    'conditional-gate',
    'message-player',
    'retrieve-data',
    'vtm-pool-resolver',
  ],
  message: [
    'message-player',
    'message-group',
    'message-channel',
    'display-image',
    'conditional-gate',
    'retrieve-data',
    'outcome-map',
    'vtm-pool-resolver',
  ],
};

function cloneDefaultBlockConfig(blockType: BlockType): Record<string, unknown> {
  return JSON.parse(JSON.stringify(defaultBlockConfigs[blockType])) as Record<string, unknown>;
}

export function createPipelineBlock(blockType: BlockType): PipelineBlock {
  return {
    blockType,
    config: cloneDefaultBlockConfig(blockType),
  };
}

export function getDefaultPipelineForEventType(type: EventType): PipelineBlock[] {
  return DEFAULT_PIPELINE_BLOCKS_BY_EVENT_TYPE[type].map(createPipelineBlock);
}

export function getSuggestedBlockTypesForEventType(type: EventType): readonly BlockType[] {
  return SUGGESTED_BLOCK_TYPES_BY_EVENT_TYPE[type];
}

function serializePipeline(pipeline: PipelineBlock[]): string {
  return JSON.stringify(pipeline);
}

export function isPipelineEqualToEventDefault(
  type: EventType,
  pipeline: PipelineBlock[] | undefined,
): boolean {
  if (!pipeline) {
    return false;
  }

  return serializePipeline(pipeline) === serializePipeline(getDefaultPipelineForEventType(type));
}

// ── Event form schema ─────────────────────────────────────────────────────────

export const pipelineBlockSchema = z.object({
  blockType: z.enum(BLOCK_TYPES),
  config: z.record(z.string(), z.unknown()),
});

export const eventFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(EVENT_TYPES),
  channelId: z.string().min(1, 'Channel is required'),
  shortCircuit: z.boolean(),
  pipeline: z.array(pipelineBlockSchema).min(1, 'Add at least one block'),
});

export type EventFormValues = z.infer<typeof eventFormSchema>;
export type PipelineBlock = z.infer<typeof pipelineBlockSchema>;

type PipelineBlockConfigNormalizer = (block: PipelineBlock) => PipelineBlock;

const pipelineBlockConfigNormalizers: Partial<Record<BlockType, PipelineBlockConfigNormalizer>> = {
  'message-group': (block) => ({
    ...block,
    config: {
      ...block.config,
      ...(normalizeRecipientIds(block.config.groupPlayerIds)
        ? { groupPlayerIds: normalizeRecipientIds(block.config.groupPlayerIds) }
        : { groupPlayerIds: undefined }),
    },
  }),
  'message-player': (block) => ({
    ...block,
    config: {
      ...block.config,
      ...(normalizeRecipientIds(block.config.playerIds)
        ? { playerIds: normalizeRecipientIds(block.config.playerIds) }
        : { playerIds: undefined }),
    },
  }),
};

export function normalizePipelineForSubmission(
  pipeline: PipelineBlock[],
  shortCircuit: boolean,
): PipelineBlock[] {
  return pipeline.map((block) => {
    const normalized = pipelineBlockConfigNormalizers[block.blockType]?.(block) ?? block;
    if (normalized.blockType !== 'outcome-map') {
      return normalized;
    }

    return {
      ...normalized,
      config: {
        ...normalized.config,
        shortCircuit,
      },
    };
  });
}

export function normalizeEventFormValues(values: EventFormValues): EventFormValues {
  return {
    ...values,
    pipeline: normalizePipelineForSubmission(values.pipeline, values.shortCircuit),
  };
}
