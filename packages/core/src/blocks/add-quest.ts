import type { BlockDefinition } from '@constancia/contracts';
import { PIPELINE_BLOCK, requirePipelineBlockSpec } from '@constancia/block-catalogue';

interface AddQuestConfig {
  name: string;
  description?: string;
  visible?: boolean;
}

const spec = requirePipelineBlockSpec(PIPELINE_BLOCK.AddQuest);

export const addQuestBlock: BlockDefinition<AddQuestConfig> = {
  type: PIPELINE_BLOCK.AddQuest,
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
