import { z } from 'zod';
import {
  PIPELINE_BLOCK_SPECS,
  PIPELINE_BLOCK_TYPES,
  createDefaultPipelineBlock,
  type PipelineBlockType,
} from '@constancia/block-catalogue';

// ── Per-block config schemas ──────────────────────────────────────────────────

function normalizeRecipientIds(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const ids: string[] = [];
    for (const entry of value) {
      if (typeof entry !== 'string') continue;
      const id = entry.trim();
      if (id) ids.push(id);
    }

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

export const addJournalEntryConfigSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Journal entry is required'),
  visible: z.boolean().optional(),
});

export const addQuestConfigSchema = z.object({
  name: z.string().min(1, 'Quest name is required'),
  description: z.string().optional(),
  visible: z.boolean().optional(),
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
  difficulty: z.coerce.number().optional(),
});

export const vtmInsightResolverConfigSchema = z.object({
  attribute: z.string().min(1, 'Attribute key is required'),
  skill: z.string().min(1, 'Skill key is required'),
});

const pipelineBlockConfigSchemas = {
  'message-player': messagePlayerConfigSchema,
  'message-channel': messageContentConfigSchema,
  'message-group': messageGroupConfigSchema,
  'display-image': displayImageConfigSchema,
  'add-journal-entry': addJournalEntryConfigSchema,
  'add-quest': addQuestConfigSchema,
  'conditional-gate': conditionalGateConfigSchema,
  'outcome-map': outcomeMapConfigSchema,
  'retrieve-data': retrieveDataConfigSchema,
  'vtm-pool-resolver': vtmPoolResolverConfigSchema,
  'vtm-insight-resolver': vtmInsightResolverConfigSchema,
} as const satisfies Record<PipelineBlockType, z.ZodType>;

// ── Block types ───────────────────────────────────────────────────────────────

export const BLOCK_TYPES = PIPELINE_BLOCK_TYPES as readonly [
  PipelineBlockType,
  ...PipelineBlockType[],
];

export type BlockType = PipelineBlockType;
export const EVENT_TYPES = ['test', 'narration', 'insight', 'message'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const BLOCK_LABELS = Object.fromEntries(
  PIPELINE_BLOCK_SPECS.map((spec) => [spec.blockType, spec.label]),
) as Record<BlockType, string>;

export const defaultBlockConfigs = new Map<BlockType, Record<string, unknown>>(
  PIPELINE_BLOCK_SPECS.map((spec) => [spec.blockType, spec.defaultConfig]),
);

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
    'add-journal-entry',
    'add-quest',
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
  return createDefaultPipelineBlock(blockType).config;
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

export const pipelineBlockSchema = z
  .object({
    blockType: z.enum(BLOCK_TYPES),
    config: z.record(z.string(), z.unknown()),
  })
  .superRefine((block, context) => {
    const parsed = pipelineBlockConfigSchemas[block.blockType].safeParse(block.config);
    if (parsed.success) {
      return;
    }

    for (const issue of parsed.error.issues) {
      context.addIssue({
        code: 'custom',
        message: issue.message,
        path: ['config', ...issue.path],
      });
    }
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
