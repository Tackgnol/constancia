import type { BlockDefinition } from '@constancia/contracts';

interface MessageGroupConfig {
  content: string;
  imageUrl?: string;
  groupPlayerIds?: string[];
}

export const messageGroupBlock: BlockDefinition<MessageGroupConfig> = {
  type: 'message-group',
  label: 'Message Group',
  configSchema: {
    type: 'object',
    properties: {
      content: { type: 'string' },
      imageUrl: { type: 'string' },
      groupPlayerIds: { type: 'array', items: { type: 'string' } },
    },
    required: ['content'],
  },
  execute: async (config: MessageGroupConfig) => ({
    output: null,
    messages: [
      {
        target: 'group',
        targetId: config.groupPlayerIds?.join(',') ?? 'group',
        content: config.content,
        imageUrl: config.imageUrl,
      },
    ],
  }),
};
