import { z } from 'zod';

// ── Per-block config schemas ──────────────────────────────────────────────────

// Used by message-player only
export const messagePlayerConfigSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  imageUrl: z.string().optional(),
  playerIds: z.string().optional(), // comma-separated player IDs
});

// Used by message-channel
export const messageContentConfigSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  imageUrl: z.string().optional(),
});

export const messageGroupConfigSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  imageUrl: z.string().optional(),
  groupPlayerIds: z.string().optional(), // comma-separated player IDs
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
  minScore: z.coerce.number(),
  maxScore: z.coerce.number(),
  text: z.string().min(1, 'Text is required'),
});

export const outcomeMapConfigSchema = z.object({
  outcomes: z.array(outcomeEntrySchema).min(1, 'Add at least one outcome'),
  shortCircuit: z.boolean().optional(),
});

export const retrieveDataConfigSchema = z.object({
  dataType: z.string().min(1, 'Data type is required'),
});

export const vtmPoolResolverConfigSchema = z.object({
  attribute: z.string().min(1, 'Attribute key is required'),
  skill: z.string().min(1, 'Skill key is required'),
  difficulty: z.coerce.number().min(1).max(10),
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
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_LABELS: Record<BlockType, string> = {
  'message-player': 'Message Player',
  'message-channel': 'Message Channel',
  'message-group': 'Message Group',
  'display-image': 'Display Image',
  'conditional-gate': 'Conditional Gate',
  'outcome-map': 'Outcome Map',
  'retrieve-data': 'Retrieve Data',
  'vtm-pool-resolver': 'VTM V5 Dice Pool',
};

export const defaultBlockConfigs: Record<BlockType, Record<string, unknown>> = {
  'message-player': { content: '', imageUrl: '', playerIds: '' },
  'message-channel': { content: '', imageUrl: '' },
  'message-group': { content: '', imageUrl: '', groupPlayerIds: '' },
  'display-image': { imageUrl: '', caption: '' },
  'conditional-gate': { statPath: '', operator: 'gte', threshold: 1 },
  'outcome-map': { outcomes: [{ minScore: 0, maxScore: 10, text: '' }] },
  'retrieve-data': { dataType: '' },
  'vtm-pool-resolver': { attribute: '', skill: '', difficulty: 3 },
};

// ── Event form schema ─────────────────────────────────────────────────────────

export const pipelineBlockSchema = z.object({
  blockType: z.enum(BLOCK_TYPES),
  config: z.record(z.string(), z.unknown()),
});

export const eventFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['test', 'narration', 'insight', 'message']),
  channelId: z.string().min(1, 'Channel is required'),
  shortCircuit: z.boolean(),
  pipeline: z.array(pipelineBlockSchema).min(1, 'Add at least one block'),
});

export type EventFormValues = z.infer<typeof eventFormSchema>;
export type PipelineBlock = z.infer<typeof pipelineBlockSchema>;
