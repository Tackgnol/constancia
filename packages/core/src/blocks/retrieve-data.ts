import type { BlockContext, BlockDefinition } from '@constancia/contracts';
import { PIPELINE_BLOCK, requirePipelineBlockSpec } from '@constancia/block-catalogue';

interface RetrieveDataConfig {
  dataType: string;
  query?: Record<string, unknown>;
}

const spec = requirePipelineBlockSpec(PIPELINE_BLOCK.RetrieveData);

export const retrieveDataBlock: BlockDefinition<RetrieveDataConfig> = {
  type: PIPELINE_BLOCK.RetrieveData,
  label: spec.label,
  configSchema: spec.configSchema,
  execute: async (config: RetrieveDataConfig, ctx: BlockContext) => ({
    output: {
      dataType: config.dataType,
      query: config.query,
      characterData: ctx.characterData,
    },
  }),
};
