import type { BlockDefinition } from '@constancia/contracts';

interface AddQuestConfig {
  name: string;
  description?: string;
  visible?: boolean;
}

export const addQuestBlock: BlockDefinition<AddQuestConfig> = {
  type: 'add-quest',
  label: 'Add Quest',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      visible: { type: 'boolean' },
    },
    required: ['name'],
  },
  execute: async (config) => {
    const effect = {
      kind: 'add-quest' as const,
      name: config.name,
      description: config.description ?? '',
      visible: config.visible ?? true,
    };

    return {
      output: effect,
      effects: [effect],
    };
  },
};
