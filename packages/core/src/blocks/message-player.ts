import type { BlockContext, BlockDefinition } from '@constancia/contracts';

interface MessagePlayerConfig {
  content: string;
  imageUrl?: string;
  /**
   * Comma-separated player IDs to target.
   * When provided, one message is emitted per ID.
   * When omitted, the block falls back to ctx.playerId (original behaviour).
   */
  playerIds?: string;
}

export const messagePlayerBlock: BlockDefinition<MessagePlayerConfig> = {
  type: 'message-player',
  label: 'Message Player',
  configSchema: {
    type: 'object',
    properties: {
      content: { type: 'string' },
      imageUrl: { type: 'string' },
      playerIds: { type: 'string' },
    },
    required: ['content'],
  },
  execute: async (config: MessagePlayerConfig, ctx: BlockContext) => {
    const ids = config.playerIds
      ? config.playerIds
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [ctx.playerId];

    return {
      output: null,
      messages: ids.map((targetId: string) => ({
        target: 'player' as const,
        targetId,
        content: config.content,
        imageUrl: config.imageUrl,
      })),
    };
  },
};
