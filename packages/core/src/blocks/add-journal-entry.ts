import type { BlockDefinition } from '@constancia/contracts';

interface AddJournalEntryConfig {
  title: string;
  content: string;
  visible?: boolean;
}

export const addJournalEntryBlock: BlockDefinition<AddJournalEntryConfig> = {
  type: 'add-journal-entry',
  label: 'Add Journal Entry',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      content: { type: 'string' },
      visible: { type: 'boolean' },
    },
    required: ['title', 'content'],
  },
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
