import type { BlockContext, BlockDefinition } from '@constancia/contracts';
import {
  GateOperator,
  PIPELINE_BLOCK,
  requirePipelineBlockSpec,
} from '@constancia/block-catalogue';

interface ConditionalGateConfig {
  statPath: string;
  operator: GateOperator;
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

const operators: Record<GateOperator, (value: number, threshold: number) => boolean> = {
  [GateOperator.AtLeast]: (value, threshold) => value >= threshold,
  [GateOperator.Above]: (value, threshold) => value > threshold,
  [GateOperator.AtMost]: (value, threshold) => value <= threshold,
  [GateOperator.Below]: (value, threshold) => value < threshold,
  [GateOperator.Exactly]: (value, threshold) => value === threshold,
};

const spec = requirePipelineBlockSpec(PIPELINE_BLOCK.ConditionalGate);

export const conditionalGateBlock: BlockDefinition<ConditionalGateConfig> = {
  type: PIPELINE_BLOCK.ConditionalGate,
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
