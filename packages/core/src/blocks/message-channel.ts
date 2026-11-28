import type { BlockDefinition } from '@constancia/contracts';
import { PIPELINE_BLOCK, requirePipelineBlockSpec } from '@constancia/block-catalogue';

interface MessageChannelConfig {
  content: string;
  imageUrl?: string;
}

const spec = requirePipelineBlockSpec(PIPELINE_BLOCK.MessageChannel);

export const messageChannelBlock: BlockDefinition<MessageChannelConfig> = {
  type: PIPELINE_BLOCK.MessageChannel,
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
