import type { BlockDefinition, BlockContext } from '@constancia/contracts';

interface VtmPoolResolverConfig {
  attribute: string;
  skill: string;
  difficulty: number;
}

interface VtmPoolResult {
  pool: number;
  normalDice: number[];
  hungerDice: number[];
  successes: number;
  critPairs: number;
  hungerOnes: number;
  outcome: 'critical_success' | 'messy_critical' | 'success' | 'failure' | 'bestial_failure';
  difficulty: number;
}

function rollDie(): number {
  return Math.floor(Math.random() * 10) + 1;
}

function rollDice(count: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(rollDie());
  }
  return results;
}

function outcomeLabel(outcome: VtmPoolResult['outcome']): string {
  switch (outcome) {
    case 'bestial_failure':
      return 'Bestial Failure';
    case 'failure':
      return 'Failure';
    case 'messy_critical':
      return 'Messy Critical';
    case 'critical_success':
      return 'Critical Success';
    case 'success':
      return 'Success';
  }
}

export const vtmPoolResolverBlock: BlockDefinition<VtmPoolResolverConfig> = {
  type: 'vtm-pool-resolver',
  label: 'VTM V5 Dice Pool Resolver',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      attribute: { type: 'string', description: 'Key into characterData.attributes' },
      skill: { type: 'string', description: 'Key into characterData.skills' },
      difficulty: { type: 'number', description: 'Number of successes needed to succeed' },
    },
    required: ['attribute', 'skill', 'difficulty'],
  },
  execute: async (
    config: VtmPoolResolverConfig,
    ctx: BlockContext,
  ): Promise<{
    output: VtmPoolResult;
    messages: { target: 'player' | 'channel'; content: string }[];
  }> => {
    const attrs = ctx.characterData.attributes as Record<string, number> | undefined;
    const skills = ctx.characterData.skills as Record<string, number> | undefined;
    const attrVal = attrs?.[config.attribute] ?? 0;
    const skillVal = skills?.[config.skill] ?? 0;
    const hunger = (ctx.characterData.hunger as number | undefined) ?? 0;
    const pool = attrVal + skillVal;

    if (pool <= 0) {
      const result: VtmPoolResult = {
        pool: 0,
        normalDice: [],
        hungerDice: [],
        successes: 0,
        critPairs: 0,
        hungerOnes: 0,
        outcome: 'failure',
        difficulty: config.difficulty,
      };
      return {
        output: result,
        messages: [
          {
            target: 'player',
            content: `🎲 Pool: 0 dice — no dice to roll. Successes: 0 vs difficulty ${config.difficulty} → Failure`,
          },
          { target: 'channel', content: `❌ Failure — no dice in pool.` },
        ],
      };
    }

    const hungerDiceCount = Math.min(Math.max(0, hunger), pool);
    const normalDiceCount = pool - hungerDiceCount;

    const normalDice = rollDice(normalDiceCount);
    const hungerDice = rollDice(hungerDiceCount);

    const normal10s = normalDice.filter((d) => d === 10).length;
    const hunger10s = hungerDice.filter((d) => d === 10).length;
    const critPairs = Math.floor((normal10s + hunger10s) / 2);

    const baseSuccesses =
      normalDice.filter((d) => d >= 6).length + hungerDice.filter((d) => d >= 6).length;

    const successes = baseSuccesses + critPairs * 2;
    const hungerOnes = hungerDice.filter((d) => d === 1).length;

    let outcome: VtmPoolResult['outcome'];
    if (successes === 0 && hungerOnes > 0) {
      outcome = 'bestial_failure';
    } else if (successes < config.difficulty) {
      outcome = 'failure';
    } else if (critPairs > 0 && hunger10s > 0) {
      outcome = 'messy_critical';
    } else if (critPairs > 0) {
      outcome = 'critical_success';
    } else {
      outcome = 'success';
    }

    const result: VtmPoolResult = {
      pool,
      normalDice,
      hungerDice,
      successes,
      critPairs,
      hungerOnes,
      outcome,
      difficulty: config.difficulty,
    };

    const label = outcomeLabel(outcome);

    const playerMsg =
      `🎲 Pool: ${pool} dice (${normalDiceCount} normal + ${hungerDiceCount} hunger)` +
      ` | Rolled: [${normalDice.join(', ')}] + hunger [${hungerDice.join(', ')}]` +
      ` | Successes: ${successes} vs difficulty ${config.difficulty} → ${label}`;

    let channelMsg: string;
    switch (outcome) {
      case 'bestial_failure':
        channelMsg = `💀 Bestial Failure — the Beast takes over.`;
        break;
      case 'failure':
        channelMsg = `❌ Failure — not enough successes.`;
        break;
      case 'messy_critical':
        channelMsg = `⚠️ Messy Critical — the Beast stirs.`;
        break;
      case 'critical_success':
        channelMsg = `✨ Critical Success — exceptional result!`;
        break;
      case 'success':
        channelMsg = `✅ Success — the roll succeeds.`;
        break;
    }

    return {
      output: result,
      messages: [
        { target: 'player', content: playerMsg },
        { target: 'channel', content: channelMsg },
      ],
    };
  },
};
