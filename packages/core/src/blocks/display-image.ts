import type { BlockDefinition } from '@constancia/contracts';
import { requirePipelineBlockSpec } from '@constancia/block-catalogue';

interface DisplayImageConfig {
  imageUrl: string;
  caption?: string;
}

const spec = requirePipelineBlockSpec('display-image');

export const displayImageBlock: BlockDefinition<DisplayImageConfig> = {
  type: 'display-image',
  label: spec.label,
  configSchema: spec.configSchema,
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
