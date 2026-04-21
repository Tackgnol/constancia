import type { BlockDefinition } from '@constancia/contracts';

function normalizeRecipientIds(ids: string | string[] | undefined): string[] {
  if (Array.isArray(ids)) {
    return ids.map((id) => id.trim()).filter(Boolean);
  }

  if (typeof ids === 'string') {
    return ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  return [];
}

interface MessageGroupConfig {
  content: string;
  imageUrl?: string;
  groupPlayerIds?: string | string[];
}

export const messageGroupBlock: BlockDefinition<MessageGroupConfig> = {
  type: 'message-group',
  label: 'Message Group',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      content: { type: 'string' },
      imageUrl: { type: 'string' },
      groupPlayerIds: { type: 'array', items: { type: 'string' } },
    },
    required: ['content'],
  },
  execute: async (config: MessageGroupConfig) => {
    const targetIds = normalizeRecipientIds(config.groupPlayerIds);

    return {
      output: null,
      messages:
        targetIds.length > 0
          ? [
              {
                target: 'group' as const,
                targetIds,
                content: config.content,
                imageUrl: config.imageUrl,
              },
            ]
          : [],
    };
  },
};
