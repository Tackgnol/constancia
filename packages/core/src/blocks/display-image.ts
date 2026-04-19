import type { BlockDefinition } from '@constancia/contracts';

interface DisplayImageConfig {
  imageUrl: string;
  caption?: string;
}

export const displayImageBlock: BlockDefinition<DisplayImageConfig> = {
  type: 'display-image',
  label: 'Display Image',
  configSchema: {
    type: 'object',
    properties: {
      imageUrl: { type: 'string' },
      caption: { type: 'string' },
    },
    required: ['imageUrl'],
  },
  execute: async (config: DisplayImageConfig) => ({
    output: null,
    messages: [
      {
        target: 'channel',
        content: config.caption ?? '',
        imageUrl: config.imageUrl,
      },
    ],
  }),
};
