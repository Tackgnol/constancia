import type { BlockDefinition } from '@constancia/contracts';
import { requirePipelineBlockSpec } from '@constancia/block-catalogue';

interface AddQuestConfig {
  name: string;
  description?: string;
  visible?: boolean;
}

const spec = requirePipelineBlockSpec('add-quest');

export const addQuestBlock: BlockDefinition<AddQuestConfig> = {
  type: 'add-quest',
  label: spec.label,
  configSchema: spec.configSchema,
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
