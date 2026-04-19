import type { BlockContext, BlockDefinition, BlockMessage } from '@constancia/contracts';

interface Outcome {
  minScore: number;
  maxScore: number;
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
    properties: {
      outcomes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            minScore: { type: 'number' },
            maxScore: { type: 'number' },
            text: { type: 'string' },
          },
          required: ['minScore', 'maxScore', 'text'],
        },
      },
      shortCircuit: { type: 'boolean' },
    },
    required: ['outcomes'],
  },
  execute: async (config: OutcomeMapConfig, ctx: BlockContext) => {
    const score = ctx.playerScore ?? 0;
    const selectedOutcomes =
      config.shortCircuit === false
        ? config.outcomes.filter((outcome: Outcome) => score >= outcome.minScore)
        : config.outcomes.filter(
            (outcome: Outcome) => score >= outcome.minScore && score <= outcome.maxScore,
          );

    const messages: BlockMessage[] = selectedOutcomes.map((outcome: Outcome) => ({
      target: 'player',
      content: outcome.text,
    }));

    return {
      output: selectedOutcomes,
      messages,
      halt: false,
    };
  },
};
