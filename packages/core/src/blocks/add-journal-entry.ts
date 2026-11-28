import type { BlockDefinition } from '@constancia/contracts';
import { PIPELINE_BLOCK, requirePipelineBlockSpec } from '@constancia/block-catalogue';

interface AddJournalEntryConfig {
  title: string;
  content: string;
  visible?: boolean;
}

const spec = requirePipelineBlockSpec(PIPELINE_BLOCK.AddJournalEntry);

export const addJournalEntryBlock: BlockDefinition<AddJournalEntryConfig> = {
  type: PIPELINE_BLOCK.AddJournalEntry,
  label: spec.label,
  configSchema: spec.configSchema,
  execute: async (config, ctx) => {
    const effect = {
      kind: 'add-journal-entry' as const,
      title: config.title,
      content: config.content,
      visible: config.visible ?? true,
      channelId: ctx.channelId,
    };

    return {
      output: effect,
      effects: [effect],
    };
  },
};
