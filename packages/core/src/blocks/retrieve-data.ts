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
    additionalProperties: false,
    properties: {
      dataType: { type: 'string' },
      query: { type: 'object', additionalProperties: true },
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
