import type { BlockDefinition } from '@constancia/contracts';
import { PIPELINE_BLOCK, requirePipelineBlockSpec } from '@constancia/block-catalogue';

interface DisplayImageConfig {
  imageUrl: string;
  caption?: string;
}

const spec = requirePipelineBlockSpec(PIPELINE_BLOCK.DisplayImage);

export const displayImageBlock: BlockDefinition<DisplayImageConfig> = {
  type: PIPELINE_BLOCK.DisplayImage,
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
