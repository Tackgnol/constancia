import type { BlockContext, BlockDefinition, BlockMessage } from '@constancia/contracts';

interface Outcome {
  threshold: number;
  text: string;
}

interface OutcomeMapConfig {
  outcomes: Outcome[];
  shortCircuit?: boolean;
}

export const outcomeMapBlock: BlockDefinition<OutcomeMapConfig> = {
  type: 'outcome-map',
  label: 'Outcome Map',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      outcomes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            threshold: { type: 'number' },
            text: { type: 'string' },
          },
          required: ['threshold', 'text'],
        },
      },
      shortCircuit: { type: 'boolean' },
    },
    required: ['outcomes'],
  },
  execute: async (config: OutcomeMapConfig, ctx: BlockContext) => {
    const score = ctx.playerScore ?? 0;
    const targetId =
      typeof ctx.playerId === 'string' &&
      ctx.playerId.trim().length > 0 &&
      ctx.playerId !== 'system'
        ? ctx.playerId
        : undefined;
    const matched = config.outcomes
      .filter((outcome) => score > outcome.threshold)
      .sort((left, right) => right.threshold - left.threshold);
    const selectedOutcomes =
      config.shortCircuit === false ? matched.reverse() : matched.slice(0, 1);

    const messages: BlockMessage[] = selectedOutcomes.map((outcome: Outcome) => ({
      target: 'player',
      ...(targetId ? { targetId } : {}),
      content: outcome.text,
    }));

    return {
      output: selectedOutcomes,
      messages,
      halt: false,
    };
  },
};
