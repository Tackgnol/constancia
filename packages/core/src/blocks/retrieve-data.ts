import type { BlockContext, BlockDefinition } from '@constancia/contracts';

interface RetrieveDataConfig {
  dataType: string;
  query?: Record<string, unknown>;
}

export const retrieveDataBlock: BlockDefinition<RetrieveDataConfig> = {
  type: 'retrieve-data',
  label: 'Retrieve Data',
  configSchema: {
    type: 'object',
    properties: {
      dataType: { type: 'string' },
      query: { type: 'object' },
    },
    required: ['dataType'],
  },
  execute: async (config: RetrieveDataConfig, ctx: BlockContext) => ({
    output: {
      dataType: config.dataType,
      query: config.query,
      characterData: ctx.characterData,
    },
  }),
};
