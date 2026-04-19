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

export const npcBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    imageUrl: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['name'],
} as const;

export const npcPatchBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    imageUrl: { type: 'string' },
    description: { type: 'string' },
  },
} as const;

export const npcFactBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    content: { type: 'string' },
    sortOrder: { type: 'integer' },
  },
  required: ['content'],
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
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          blockType: { type: 'string' },
          config: { type: 'object', additionalProperties: true },
        },
        required: ['blockType', 'config'],
      },
    },
  },
  required: ['name', 'type', 'channelId', 'pipeline'],
} as const;

export const eventPatchBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    status: { type: 'string' },
    shortCircuit: { type: 'boolean' },
    pipeline: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          blockType: { type: 'string' },
          config: { type: 'object', additionalProperties: true },
        },
        required: ['blockType', 'config'],
      },
    },
  },
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
    campaignId: { type: 'string' },
    channelId: { type: 'string' },
    discordUserId: { type: 'string' },
    playerScore: { type: 'number' },
  },
  required: ['eventId', 'campaignId', 'channelId', 'discordUserId', 'playerScore'],
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
    campaignId: { type: 'string' },
  },
  required: ['id', 'name', 'description', 'campaignId'],
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

export const npcWithFactsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    imageUrl: { type: 'string' },
    description: { type: 'string' },
    campaignId: { type: 'string' },
    facts: { type: 'array', items: { type: 'object', additionalProperties: true } },
  },
  required: ['id', 'name', 'description', 'campaignId', 'facts'],
} as const;

export const blockInstanceSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    blockType: { type: 'string' },
    config: { type: 'object', additionalProperties: true },
  },
  required: ['blockType', 'config'],
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
    status: { type: 'string' },
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
  },
  required: ['quests', 'summaries'],
} as const;

export const fireEventResultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    eventId: { type: 'string' },
    messages: { type: 'array', items: { type: 'object', additionalProperties: true } },
    halted: { type: 'boolean' },
  },
  required: ['eventId', 'messages', 'halted'],
} as const;

export const botTestResultResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    eventId: { type: 'string' },
    campaignId: { type: 'string' },
    messages: { type: 'array', items: { type: 'object', additionalProperties: true } },
    halted: { type: 'boolean' },
  },
  required: ['eventId', 'campaignId', 'messages', 'halted'],
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
