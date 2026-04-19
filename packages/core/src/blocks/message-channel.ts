import type { BlockDefinition } from '@constancia/contracts';

interface MessageChannelConfig {
  content: string;
  imageUrl?: string;
}

export const messageChannelBlock: BlockDefinition<MessageChannelConfig> = {
  type: 'message-channel',
  label: 'Message Channel',
  configSchema: {
    type: 'object',
    properties: {
      content: { type: 'string' },
      imageUrl: { type: 'string' },
    },
    required: ['content'],
  },
  execute: async (config: MessageChannelConfig) => ({
    output: null,
    messages: [
      {
        target: 'channel',
        content: config.content,
        imageUrl: config.imageUrl,
      },
    ],
  }),
};
