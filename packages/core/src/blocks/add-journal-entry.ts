import type { BlockDefinition } from '@constancia/contracts';
import { requirePipelineBlockSpec } from '@constancia/block-catalogue';

interface AddJournalEntryConfig {
  title: string;
  content: string;
  visible?: boolean;
}

const spec = requirePipelineBlockSpec('add-journal-entry');

export const addJournalEntryBlock: BlockDefinition<AddJournalEntryConfig> = {
  type: 'add-journal-entry',
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
