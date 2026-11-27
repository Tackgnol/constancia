import { z } from 'zod';
import {
  PIPELINE_BLOCK_SPECS,
  PIPELINE_BLOCK_TYPES,
  type PipelineBlockRole,
  type PipelineBlockSpec,
  type PipelineBlockType,
} from '@constancia/block-catalogue';
import { gameSystemRegistry, getPipelineBlockSpecForSystem } from '@constancia/systems';

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

// `text` intentionally allows an empty string here: it mirrors the catalogue's `outcome-map`
// JSON Schema (`packages/block-catalogue`), which has no `minLength` on `text`, and the
// catalogue's own `defaultConfig` seeds a fresh outcome with `text: ''`. Requiring non-empty
// text here would reject that default and disagree with the schema that governs the field.
export const outcomeEntrySchema = z.object({
  threshold: z.coerce.number(),
  text: z.string(),
  loreEntryIds: z.array(z.string()).optional(),
  npcFactIds: z.array(z.string()).optional(),
});

export const outcomeMapConfigSchema = z.object({
  outcomes: z.array(outcomeEntrySchema).min(1, 'Add at least one outcome'),
  shortCircuit: z.boolean().optional(),
  comparison: z.enum(['gt', 'gte']).optional(),
});

export const retrieveDataConfigSchema = z.object({
  dataType: z.string().min(1, 'Data type is required'),
  query: z.record(z.string(), z.unknown()).optional(),
});

// Role block config is shaped by the campaign's Game System; required fields are checked in
// createEventFormSchema against that system's spec.
const roleBlockConfigSchema = z.record(z.string(), z.unknown());

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
  'test-resolver': roleBlockConfigSchema,
  'insight-resolver': roleBlockConfigSchema,
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

/** The block's spec as the campaign's Game System sees it, or undefined when the system lacks its role. */
export function getBlockSpecForSystem(
  blockType: BlockType,
  gameSystemId: string,
): PipelineBlockSpec | undefined {
  const system = gameSystemRegistry.get(gameSystemId);
  if (system) return getPipelineBlockSpecForSystem(blockType, system);
  const spec = PIPELINE_BLOCK_SPECS.find((candidate) => candidate.blockType === blockType);
  return spec?.availability.kind === 'common' ? spec : undefined;
}

/** Whether an editor field shows for this config, following its `visibleWhen` rule. */
export function isEditorFieldVisible(
  field: PipelineBlockSpec['editor']['fields'][number],
  config: Record<string, unknown> | undefined,
): boolean {
  if (!field.visibleWhen) return true;
  const value = config?.[field.visibleWhen.path];
  return typeof value === 'string' && field.visibleWhen.equals.includes(value);
}

export function isBlockTypeAvailable(blockType: BlockType, gameSystemId: string): boolean {
  return getBlockSpecForSystem(blockType, gameSystemId) !== undefined;
}

const EVENT_TYPE_ROLES: Partial<Record<EventType, PipelineBlockRole>> = {
  test: 'test-resolver',
  insight: 'insight-resolver',
};

/** Event types the campaign's Game System can run; types whose role it lacks are hidden. */
export function getEventTypesForSystem(gameSystemId: string): EventType[] {
  return EVENT_TYPES.filter((type) => {
    const role = EVENT_TYPE_ROLES[type];
    return !role || isBlockTypeAvailable(role, gameSystemId);
  });
}

const DEFAULT_PIPELINE_BLOCKS_BY_EVENT_TYPE: Record<EventType, readonly BlockType[]> = {
  test: ['test-resolver', 'outcome-map'],
  narration: ['message-channel'],
  insight: ['insight-resolver', 'outcome-map'],
  message: ['message-player'],
};

const SUGGESTED_BLOCK_TYPES_BY_EVENT_TYPE: Record<EventType, readonly BlockType[]> = {
  test: [
    'test-resolver',
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
    'test-resolver',
  ],
  insight: [
    'insight-resolver',
    'outcome-map',
    'conditional-gate',
    'message-player',
    'retrieve-data',
    'test-resolver',
  ],
  message: [
    'message-player',
    'message-group',
    'message-channel',
    'display-image',
    'conditional-gate',
    'retrieve-data',
    'outcome-map',
    'test-resolver',
  ],
};

export function createPipelineBlock(blockType: BlockType, gameSystemId: string): PipelineBlock {
  const spec = getBlockSpecForSystem(blockType, gameSystemId);
  return {
    blockType,
    config: structuredClone(spec?.defaultConfig ?? {}),
  };
}

export function getDefaultPipelineForEventType(
  type: EventType,
  gameSystemId: string,
): PipelineBlock[] {
  const comparison =
    type === 'test' ? gameSystemRegistry.get(gameSystemId)?.testOutcomeComparison : undefined;
  return DEFAULT_PIPELINE_BLOCKS_BY_EVENT_TYPE[type]
    .filter((blockType) => isBlockTypeAvailable(blockType, gameSystemId))
    .map((blockType) => {
      const block = createPipelineBlock(blockType, gameSystemId);
      return blockType === 'outcome-map' && comparison
        ? { ...block, config: { ...block.config, comparison } }
        : block;
    });
}

export function getSuggestedBlockTypesForEventType(
  type: EventType,
  gameSystemId: string,
): readonly BlockType[] {
  return SUGGESTED_BLOCK_TYPES_BY_EVENT_TYPE[type].filter((blockType) =>
    isBlockTypeAvailable(blockType, gameSystemId),
  );
}

export function getAvailableBlockTypes(gameSystemId: string): readonly BlockType[] {
  return BLOCK_TYPES.filter((blockType) => isBlockTypeAvailable(blockType, gameSystemId));
}

function serializePipeline(pipeline: PipelineBlock[]): string {
  return JSON.stringify(pipeline);
}

export function isPipelineEqualToEventDefault(
  type: EventType,
  pipeline: PipelineBlock[] | undefined,
  gameSystemId: string,
): boolean {
  if (!pipeline) {
    return false;
  }

  return (
    serializePipeline(pipeline) ===
    serializePipeline(getDefaultPipelineForEventType(type, gameSystemId))
  );
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

function isMissingValue(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && !value.trim());
}

/** Event form schema for one campaign: role blocks are checked against its Game System's spec. */
export function createEventFormSchema(gameSystemId: string) {
  const systemPipelineBlockSchema = pipelineBlockSchema.superRefine((block, context) => {
    const spec = getBlockSpecForSystem(block.blockType, gameSystemId);
    if (!spec) {
      context.addIssue({
        code: 'custom',
        message: 'This Game System does not support this block.',
        path: ['blockType'],
      });
      return;
    }
    if (spec.availability.kind !== 'role') return;

    const labels = new Map(spec.editor.fields.map((field) => [field.path, field.label]));
    for (const key of spec.configSchema.required ?? []) {
      if (!isMissingValue(block.config[key])) continue;
      const label = labels.get(key) ?? key;
      context.addIssue({
        code: 'custom',
        message: `${label} is required`,
        path: ['config', key],
      });
    }
  });

  return z.object({
    name: z.string().min(1, 'Name is required'),
    type: z.enum(EVENT_TYPES),
    channelId: z.string().min(1, 'Channel is required'),
    shortCircuit: z.boolean(),
    pipeline: z.array(systemPipelineBlockSchema).min(1, 'Add at least one block'),
  });
}

export type EventFormValues = z.infer<ReturnType<typeof createEventFormSchema>>;
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
