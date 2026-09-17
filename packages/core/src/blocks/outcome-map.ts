import type {
  BlockContext,
  BlockDefinition,
  BlockEffect,
  BlockMessage,
} from '@constancia/contracts';
import { requirePipelineBlockSpec } from '@constancia/block-catalogue';

interface Outcome {
  threshold: number;
  text: string;
  loreEntryIds?: string[];
  npcFactIds?: string[];
}

interface OutcomeMapConfig {
  outcomes: Outcome[];
  shortCircuit?: boolean;
}

const spec = requirePipelineBlockSpec('outcome-map');

export const outcomeMapBlock: BlockDefinition<OutcomeMapConfig> = {
  type: 'outcome-map',
  label: spec.label,
  configSchema: spec.configSchema,
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

    // Knowledge grants need a specific player to attach to — a system-fired
    // Event (no submitting player) never grants Lore/NPC facts.
    const effects: BlockEffect[] = targetId
      ? selectedOutcomes.flatMap((outcome: Outcome) => [
          ...(outcome.loreEntryIds ?? []).map(
            (loreEntryId): BlockEffect => ({
              kind: 'grant-lore-entry',
              loreEntryId,
              discordUserId: targetId,
            }),
          ),
          ...(outcome.npcFactIds ?? []).map(
            (npcFactId): BlockEffect => ({
              kind: 'grant-npc-fact',
              npcFactId,
              discordUserId: targetId,
            }),
          ),
        ])
      : [];

    return {
      output: selectedOutcomes,
      messages,
      effects,
      halt: false,
    };
  },
};
