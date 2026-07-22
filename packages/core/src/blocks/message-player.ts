import type { BlockContext, BlockDefinition } from '@constancia/contracts';
import { requirePipelineBlockSpec } from '@constancia/block-catalogue';

function normalizeRecipientIds(ids: string | string[] | undefined): string[] {
  if (Array.isArray(ids)) {
    return ids.map((id) => id.trim()).filter(Boolean);
  }

  if (typeof ids === 'string') {
    return ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  return [];
}

interface MessagePlayerConfig {
  content: string;
  imageUrl?: string;
  /**
   * Player IDs to target.
   * When provided, one message is emitted per ID.
   * When omitted, the block falls back to ctx.playerId (original behaviour).
   */
  playerIds?: string | string[];
}

const spec = requirePipelineBlockSpec('message-player');

export const messagePlayerBlock: BlockDefinition<MessagePlayerConfig> = {
  type: 'message-player',
  label: spec.label,
  configSchema: spec.configSchema,
  execute: async (config: MessagePlayerConfig, ctx: BlockContext) => {
    const ids = normalizeRecipientIds(config.playerIds);
    const recipients = ids.length > 0 ? ids : [ctx.playerId];

    return {
      output: null,
      messages: recipients.map((targetId: string) => ({
        target: 'player' as const,
        targetId,
        content: config.content,
        imageUrl: config.imageUrl,
      })),
    };
  },
};
