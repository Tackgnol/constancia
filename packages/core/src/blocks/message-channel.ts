import type { BlockDefinition } from '@constancia/contracts';
import { requirePipelineBlockSpec } from '@constancia/block-catalogue';

interface MessageChannelConfig {
  content: string;
  imageUrl?: string;
}

const spec = requirePipelineBlockSpec('message-channel');

export const messageChannelBlock: BlockDefinition<MessageChannelConfig> = {
  type: 'message-channel',
  label: spec.label,
  configSchema: spec.configSchema,
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
