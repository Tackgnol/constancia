import type { BlockContext, BlockDefinition } from '@constancia/contracts';
import { requirePipelineBlockSpec } from '@constancia/block-catalogue';

interface RetrieveDataConfig {
  dataType: string;
  query?: Record<string, unknown>;
}

const spec = requirePipelineBlockSpec('retrieve-data');

export const retrieveDataBlock: BlockDefinition<RetrieveDataConfig> = {
  type: 'retrieve-data',
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
