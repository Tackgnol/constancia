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
