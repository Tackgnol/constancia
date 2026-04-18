import type { BlockDefinition } from '@constancia/contracts';

interface MessagePlayerConfig {
  content: string;
  imageUrl?: string;
}

export const messagePlayerBlock: BlockDefinition<MessagePlayerConfig> = {
  type: 'message-player',
  label: 'Message Player',
  configSchema: {
    type: 'object',
    properties: {
      content: { type: 'string' },
      imageUrl: { type: 'string' },
    },
    required: ['content'],
  },
  execute: async (config) => ({
    output: null,
    messages: [
      {
        target: 'player',
        content: config.content,
        imageUrl: config.imageUrl,
      },
    ],
  }),
};
