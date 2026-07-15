import { registeredBlockSchemas } from './blocks.js';
import type { EventStatus } from '@constancia/contracts';

export const eventStatusValues = [
  'draft',
  'ready',
  'fired',
  'archived',
] as const satisfies readonly EventStatus[];

export const eventStatusSchema = {
  type: 'string',
  enum: eventStatusValues,
} as const;

export const identifierParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
  },
  required: ['id'],
} as const;

export const campaignParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
  },
  required: ['id'],
} as const;

export const characterParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    charId: { type: 'string' },
  },
  required: ['id', 'charId'],
} as const;

export const npcParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    npcId: { type: 'string' },
  },
  required: ['id', 'npcId'],
} as const;

export const campaignDiscordUserParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    discordUserId: { type: 'string' },
  },
  required: ['id', 'discordUserId'],
} as const;

export const eventParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    eventId: { type: 'string' },
  },
  required: ['id', 'eventId'],
} as const;

export const questParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    questId: { type: 'string' },
  },
  required: ['id', 'questId'],
} as const;

export const questEntryParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    questId: { type: 'string' },
    entryId: { type: 'string' },
  },
  required: ['id', 'questId', 'entryId'],
} as const;

export const loreParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    loreId: { type: 'string' },
  },
  required: ['id', 'loreId'],
} as const;

export const summaryParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    sumId: { type: 'string' },
  },
  required: ['id', 'sumId'],
} as const;

export const discordTargetParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    discordId: { type: 'string' },
  },
  required: ['id', 'discordId'],
} as const;

export const guildParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    guildId: { type: 'string' },
  },
  required: ['guildId'],
} as const;

export const channelParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    channelId: { type: 'string' },
  },
  required: ['channelId'],
} as const;

export const campaignChannelParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    chanId: { type: 'string' },
  },
  required: ['id', 'chanId'],
} as const;

export const channelBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    discordChannelId: { type: 'string' },
    type: { type: 'string', enum: ['main', 'scene', 'temp'] },
  },
  required: ['name', 'discordChannelId'],
} as const;

export const channelPatchBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    type: { type: 'string', enum: ['main', 'scene', 'temp'] },
  },
} as const;

export const tokenQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    token: { type: 'string' },
  },
  required: ['token'],
} as const;

export const authMagicLinkBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    discordUserId: { type: 'string' },
    guildId: { type: 'string' },
  },
  required: ['discordUserId', 'guildId'],
} as const;

export const playerSheetMagicLinkBodySchema = {
  ...authMagicLinkBodySchema,
} as const;

export const playerJournalMagicLinkBodySchema = {
  ...authMagicLinkBodySchema,
} as const;

export const uploadAssetParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assetId: { type: 'string' },
  },
  required: ['assetId'],
} as const;

export const uploadImageBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['file'],
  properties: {
    file: { type: 'string', format: 'binary' },
    caption: { type: 'string' },
  },
} as const;

export const campaignBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    discordGuildId: { type: 'string' },
    gameSystemId: { type: 'string' },
  },
  required: ['name', 'discordGuildId', 'gameSystemId'],
} as const;

export const campaignPatchBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    gameSystemId: { type: 'string' },
  },
} as const;

export const characterBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    discordUserId: { type: 'string' },
    backstory: { type: 'string' },
    notes: { type: 'string' },
    systemData: { type: 'object', additionalProperties: true },
  },
  required: ['name', 'discordUserId'],
} as const;

export const characterPatchBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    gameName: { type: 'string' },
    backstory: { type: 'string' },
    notes: { type: 'string' },
    systemData: { type: 'object', additionalProperties: true },
  },
} as const;

export const characterSheetPatchBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    gameName: { type: 'string' },
    backstory: { type: 'string' },
    notes: { type: 'string' },
    stats: { type: 'object', additionalProperties: true },
  },
} as const;

export const progenyVtmCharacterBodySchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 },
    description: { type: 'string', maxLength: 4000 },
    notes: { type: 'string', maxLength: 4000 },
    attributes: {
      type: 'object',
      additionalProperties: { type: 'integer' },
    },
    skills: {
      type: 'object',
      additionalProperties: { type: 'integer' },
    },
    version: { type: 'integer', minimum: 1 },
    characterVersion: { type: 'integer', minimum: 0 },
  },
  required: ['name', 'attributes', 'skills', 'version'],
} as const;

const npcSystemBlockSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    systemId: { type: 'string' },
    blockType: { type: 'string' },
    label: { type: 'string' },
    value: {},
  },
  required: ['blockType', 'label', 'value'],
} as const;

const knownPlayerSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    characterId: { type: 'string' },
    discordUserId: { type: 'string' },
    displayName: { type: 'string' },
    secondaryLabel: { type: 'string' },
  },
  required: ['characterId', 'discordUserId', 'displayName', 'secondaryLabel'],
} as const;

const npcFactCreateSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    content: { type: 'string' },
    sortOrder: { type: 'integer' },
  },
  required: ['content'],
} as const;

export const npcBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    systemBlocks: { type: 'array', items: npcSystemBlockSchema },
    imageUrl: { type: 'string' },
    description: { type: 'string' },
    facts: { type: 'array', items: npcFactCreateSchema },
  },
  required: ['name'],
} as const;

export const npcPatchBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    systemBlocks: { type: 'array', items: npcSystemBlockSchema },
    imageUrl: { type: 'string' },
    description: { type: 'string' },
  },
} as const;

export const npcFactBodySchema = {
  ...npcFactCreateSchema,
} as const;

export const npcRevealBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    npcFactIds: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    },
    discordUserIds: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    },
  },
  required: ['npcFactIds', 'discordUserIds'],
} as const;

function withStrictObjectDefaults(schema: Record<string, unknown>): Record<string, unknown> {
  return schema.type === 'object' && typeof schema.additionalProperties === 'undefined'
    ? { ...schema, additionalProperties: false }
    : schema;
}

const blockInstanceVariants = registeredBlockSchemas.map((block) => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    blockType: { const: block.type, type: 'string' },
    config: withStrictObjectDefaults(block.configSchema as Record<string, unknown>),
  },
  required: ['blockType', 'config'],
}));

export const blockInstanceSchema = {
  anyOf: blockInstanceVariants,
} as const;

export const eventBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    type: { type: 'string' },
    channelId: { type: 'string' },
    shortCircuit: { type: 'boolean' },
    pipeline: {
      type: 'array',
      items: blockInstanceSchema,
    },
  },
  required: ['name', 'type', 'channelId', 'pipeline'],
} as const;

export const eventPatchBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    type: { type: 'string' },
    channelId: { type: 'string' },
    status: eventStatusSchema,
    shortCircuit: { type: 'boolean' },
    pipeline: {
      type: 'array',
      items: blockInstanceSchema,
    },
  },
} as const;

export const playerMessageBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    channelId: { type: 'string' },
    discordUserIds: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    },
    content: { type: 'string', minLength: 1 },
    imageUrl: { type: 'string' },
  },
  required: ['channelId', 'discordUserIds', 'content'],
} as const;

export const questBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    visible: { type: 'boolean' },
  },
  required: ['name'],
} as const;

export const questPatchBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    status: { type: 'string' },
    visible: { type: 'boolean' },
  },
} as const;

export const questEntryBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    content: { type: 'string' },
    status: { type: 'string' },
    sortOrder: { type: 'integer' },
  },
  required: ['content'],
} as const;

export const loreBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1 },
    content: { type: 'string', minLength: 1 },
    sortOrder: { type: 'integer' },
  },
  required: ['title', 'content'],
} as const;

export const lorePatchBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1 },
    content: { type: 'string', minLength: 1 },
    sortOrder: { type: 'integer' },
  },
} as const;

export const loreRevealBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    discordUserIds: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    },
  },
  required: ['discordUserIds'],
} as const;

export const summaryBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    content: { type: 'string' },
    sessionDate: { type: 'string', format: 'date-time' },
    visible: { type: 'boolean' },
    channelId: { type: 'string' },
  },
  required: ['title', 'content', 'sessionDate'],
} as const;

export const botTestResultBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    eventId: { type: 'string' },
    discordUserId: { type: 'string' },
    discordChannelId: { type: 'string' },
    playerScore: { type: 'number' },
    idempotencyKey: { type: 'string', minLength: 1 },
  },
  required: ['eventId', 'discordUserId', 'discordChannelId', 'playerScore', 'idempotencyKey'],
} as const;

export const idempotencyKeyHeaderSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    'idempotency-key': { type: 'string', minLength: 1 },
  },
  required: ['idempotency-key'],
} as const;

export const botMessageReportBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    eventId: { type: 'string' },
    campaignId: { type: 'string' },
    discordGuildId: { type: 'string' },
    discordChannelId: { type: 'string' },
    discordMessageId: { type: 'string' },
    discordUserId: { type: 'string' },
    messageTarget: { type: 'string' },
    messageContent: { type: 'string' },
    imageUrl: { type: 'string' },
  },
  required: ['eventId', 'discordUserId'],
} as const;

export const standardResponseSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    status: { type: 'string' },
    data: {},
  },
  required: ['status', 'data'],
} as const;

export const deleteResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string' },
    deleted: { type: 'boolean' },
  },
  required: ['status', 'deleted'],
} as const;

// ─── Entity schemas ────────────────────────────────────────

export const campaignSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    discordGuildId: { type: 'string' },
    gameSystemId: { type: 'string' },
  },
  required: ['id', 'name', 'discordGuildId', 'gameSystemId'],
} as const;

export const userUploadSettingsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    uploadsEnabled: { type: 'boolean' },
    quota: {
      type: 'object',
      additionalProperties: false,
      properties: {
        uploadAllowanceBytes: { type: 'integer' },
        uploadUsedBytes: { type: 'integer' },
        uploadRemainingBytes: { type: 'integer' },
        uploadUsagePercent: { type: 'integer' },
        uploadNearLimit: { type: 'boolean' },
      },
      required: [
        'uploadAllowanceBytes',
        'uploadUsedBytes',
        'uploadRemainingBytes',
        'uploadUsagePercent',
        'uploadNearLimit',
      ],
    },
  },
  required: ['uploadsEnabled', 'quota'],
} as const;

export const uploadAssetSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assetId: { type: 'string' },
    url: { type: 'string' },
    mimeType: { type: 'string' },
    sizeBytes: { type: 'integer' },
    quota: userUploadSettingsSchema.properties.quota,
  },
  required: ['assetId', 'url', 'mimeType', 'sizeBytes', 'quota'],
} as const;

export const characterSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    discordUserId: { type: 'string' },
    discordName: { type: 'string' },
    gameName: { type: 'string' },
    campaignId: { type: 'string' },
    backstory: { type: 'string' },
    notes: { type: 'string' },
    systemData: { type: 'object', additionalProperties: true },
  },
  required: [
    'id',
    'name',
    'discordUserId',
    'discordName',
    'gameName',
    'campaignId',
    'backstory',
    'notes',
  ],
} as const;

export const npcSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    imageUrl: { type: 'string' },
    description: { type: 'string' },
    systemBlocks: { type: 'array', items: npcSystemBlockSchema },
    campaignId: { type: 'string' },
  },
  required: ['id', 'name', 'description', 'systemBlocks', 'campaignId'],
} as const;

export const npcFactSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    content: { type: 'string' },
    sortOrder: { type: 'integer' },
    npcId: { type: 'string' },
  },
  required: ['id', 'content', 'sortOrder', 'npcId'],
} as const;

export const npcFactKnowledgeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    content: { type: 'string' },
    sortOrder: { type: 'integer' },
    npcId: { type: 'string' },
    knownTo: {
      type: 'array',
      items: knownPlayerSchema,
    },
  },
  required: ['id', 'content', 'sortOrder', 'npcId', 'knownTo'],
} as const;

export const npcWithFactsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    imageUrl: { type: 'string' },
    description: { type: 'string' },
    systemBlocks: { type: 'array', items: npcSystemBlockSchema },
    campaignId: { type: 'string' },
    facts: { type: 'array', items: npcFactSchema },
  },
  required: ['id', 'name', 'description', 'systemBlocks', 'campaignId', 'facts'],
} as const;

export const playerVisibleNpcSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    imageUrl: { type: 'string' },
    campaignId: { type: 'string' },
    facts: { type: 'array', items: npcFactSchema },
  },
  required: ['id', 'name', 'campaignId', 'facts'],
} as const;

export const npcWithKnowledgeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    imageUrl: { type: 'string' },
    description: { type: 'string' },
    systemBlocks: { type: 'array', items: npcSystemBlockSchema },
    campaignId: { type: 'string' },
    facts: { type: 'array', items: npcFactKnowledgeSchema },
  },
  required: ['id', 'name', 'description', 'systemBlocks', 'campaignId', 'facts'],
} as const;

export const gameEventSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string' },
    channelId: { type: 'string' },
    campaignId: { type: 'string' },
    status: eventStatusSchema,
    shortCircuit: { type: 'boolean' },
    pipeline: { type: 'array', items: blockInstanceSchema },
  },
  required: ['id', 'name', 'type', 'channelId', 'campaignId', 'status', 'shortCircuit', 'pipeline'],
} as const;

export const questEntrySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    content: { type: 'string' },
    questId: { type: 'string' },
    status: { type: 'string' },
    sortOrder: { type: 'integer' },
  },
  required: ['id', 'content', 'questId', 'status', 'sortOrder'],
} as const;

export const questSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    campaignId: { type: 'string' },
    status: { type: 'string' },
    sortOrder: { type: 'integer' },
    visible: { type: 'boolean' },
    entries: { type: 'array', items: questEntrySchema },
  },
  required: ['id', 'name', 'description', 'campaignId', 'status', 'sortOrder', 'visible'],
} as const;

export const loreEntrySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    content: { type: 'string' },
    campaignId: { type: 'string' },
    sortOrder: { type: 'integer' },
  },
  required: ['id', 'title', 'content', 'campaignId', 'sortOrder'],
} as const;

export const loreEntryWithKnowledgeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    content: { type: 'string' },
    campaignId: { type: 'string' },
    sortOrder: { type: 'integer' },
    knownTo: {
      type: 'array',
      items: knownPlayerSchema,
    },
  },
  required: ['id', 'title', 'content', 'campaignId', 'sortOrder', 'knownTo'],
} as const;

export const sessionSummarySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    content: { type: 'string' },
    campaignId: { type: 'string' },
    sessionDate: { type: 'string', format: 'date-time' },
    visible: { type: 'boolean' },
    channelId: { type: 'string' },
  },
  required: ['id', 'title', 'content', 'campaignId', 'sessionDate', 'visible'],
} as const;

export const channelSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    discordChannelId: { type: 'string' },
    campaignId: { type: 'string' },
    type: { type: 'string' },
  },
  required: ['id', 'name', 'discordChannelId', 'campaignId', 'type'],
} as const;

export const gameSystemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    version: { type: 'string' },
  },
  required: ['id', 'name', 'version'],
} as const;

export const journalForPlayerSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    quests: { type: 'array', items: questSchema },
    summaries: { type: 'array', items: sessionSummarySchema },
    npcs: { type: 'array', items: playerVisibleNpcSchema },
    lore: { type: 'array', items: loreEntrySchema },
  },
  required: ['quests', 'summaries', 'npcs', 'lore'],
} as const;

export const blockMessagePlayerSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    target: { const: 'player', type: 'string' },
    targetId: { type: 'string' },
    content: { type: 'string' },
    imageUrl: { type: 'string' },
  },
  required: ['target', 'content'],
} as const;

export const blockMessageChannelSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    target: { const: 'channel', type: 'string' },
    content: { type: 'string' },
    imageUrl: { type: 'string' },
  },
  required: ['target', 'content'],
} as const;

export const blockMessageGroupSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    target: { const: 'group', type: 'string' },
    targetIds: { type: 'array', items: { type: 'string' } },
    content: { type: 'string' },
    imageUrl: { type: 'string' },
  },
  required: ['target', 'targetIds', 'content'],
} as const;

export const blockMessageSchema = {
  anyOf: [blockMessagePlayerSchema, blockMessageChannelSchema, blockMessageGroupSchema],
} as const;

export const fireEventResultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    idempotencyKey: { type: 'string' },
    kind: { type: 'string', enum: ['fire', 'test-result'] },
    eventId: { type: 'string' },
    campaignId: { type: 'string' },
    status: { type: 'string', enum: ['completed', 'failed'] },
    messages: { type: 'array', items: blockMessageSchema },
    halted: { type: 'boolean' },
    deliveries: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'delivered', 'failed'] },
          attempts: { type: 'number' },
          lastError: { type: 'string' },
          deliveredAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'status', 'attempts'],
      },
    },
    error: {
      type: 'object',
      additionalProperties: false,
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['code', 'message'],
    },
    createdAt: { type: 'string', format: 'date-time' },
    completedAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'id',
    'idempotencyKey',
    'kind',
    'eventId',
    'campaignId',
    'status',
    'messages',
    'halted',
    'deliveries',
    'createdAt',
    'completedAt',
  ],
} as const;

export const playerMessageResultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    campaignId: { type: 'string' },
    channelId: { type: 'string' },
    deliveredTo: { type: 'array', items: { type: 'string' } },
  },
  required: ['campaignId', 'channelId', 'deliveredTo'],
} as const;

export const botTestResultResponseSchema = fireEventResultSchema;

export const messageReportSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    eventId: { type: 'string' },
    campaignId: { type: 'string' },
    discordGuildId: { type: 'string' },
    discordChannelId: { type: 'string' },
    discordMessageId: { type: 'string' },
    discordUserId: { type: 'string' },
    messageTarget: { type: 'string' },
    messageContent: { type: 'string' },
    imageUrl: { type: 'string' },
    status: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'discordUserId', 'messageContent', 'status', 'createdAt'],
} as const;

export const setupChannelBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    guildId: { type: 'string' },
    guildName: { type: 'string' },
    discordChannelId: { type: 'string' },
    channelName: { type: 'string' },
    campaignName: { type: 'string' },
    gameSystemId: { type: 'string' },
  },
  required: [
    'guildId',
    'guildName',
    'discordChannelId',
    'channelName',
    'campaignName',
    'gameSystemId',
  ],
} as const;

export const setupChannelDataSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    campaign: campaignSchema,
    channel: channelSchema,
    created: {
      type: 'object',
      additionalProperties: false,
      properties: {
        campaign: { type: 'boolean' },
        channel: { type: 'boolean' },
      },
      required: ['campaign', 'channel'],
    },
  },
  required: ['campaign', 'channel', 'created'],
} as const;

export const participantEntrySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    discordUserId: { type: 'string' },
    discordName: { type: 'string' },
  },
  required: ['discordUserId', 'discordName'],
} as const;

export const syncParticipantsBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    guildId: { type: 'string' },
    participants: { type: 'array', items: participantEntrySchema, minItems: 1 },
  },
  required: ['guildId', 'participants'],
} as const;

export const syncParticipantsDataSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    campaignId: { type: 'string' },
    upserted: { type: 'integer' },
  },
  required: ['campaignId', 'upserted'],
} as const;

export const participantParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    guildId: { type: 'string' },
    discordUserId: { type: 'string' },
  },
  required: ['guildId', 'discordUserId'],
} as const;

// ─── Response wrappers ────────────────────────────────────────

export function listResponseSchema<T extends object>(itemSchema: T) {
  return {
    type: 'object' as const,
    properties: {
      status: { type: 'string' as const },
      data: { type: 'array' as const, items: itemSchema },
    },
    required: ['status', 'data'] as ['status', 'data'],
  };
}

export function singleResponseSchema<T extends object>(dataSchema: T) {
  return {
    type: 'object' as const,
    properties: {
      status: { type: 'string' as const },
      data: dataSchema,
    },
    required: ['status', 'data'] as ['status', 'data'],
  };
}
