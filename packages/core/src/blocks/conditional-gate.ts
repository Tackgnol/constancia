import type { BlockContext, BlockDefinition } from '@constancia/contracts';
import { requirePipelineBlockSpec } from '@constancia/block-catalogue';

type Operator = 'gte' | 'gt' | 'lte' | 'lt' | 'eq';

interface ConditionalGateConfig {
  statPath: string;
  operator: Operator;
  threshold: number;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, obj);
}

const operators: Record<Operator, (value: number, threshold: number) => boolean> = {
  gte: (value, threshold) => value >= threshold,
  gt: (value, threshold) => value > threshold,
  lte: (value, threshold) => value <= threshold,
  lt: (value, threshold) => value < threshold,
  eq: (value, threshold) => value === threshold,
};

const spec = requirePipelineBlockSpec('conditional-gate');

export const conditionalGateBlock: BlockDefinition<ConditionalGateConfig> = {
  type: 'conditional-gate',
  label: spec.label,
  configSchema: spec.configSchema,
  execute: async (config: ConditionalGateConfig, ctx: BlockContext) => {
    const value = getNestedValue(ctx.characterData, config.statPath);
    const numericValue = typeof value === 'number' ? value : Number.NaN;
    const operatorFunc = operators[config.operator];
    const passed = operatorFunc(numericValue, config.threshold);

    return {
      output: { statPath: config.statPath, value, passed },
      halt: !passed,
    };
  },
};
