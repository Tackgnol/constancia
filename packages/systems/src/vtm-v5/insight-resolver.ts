import type { BlockContext, BlockDefinition } from '@constancia/contracts';
import {
  requirePipelineBlockSpec,
  type RoleBlockImplementationSpec,
} from '@constancia/block-catalogue';

interface VtmInsightResolverConfig {
  attribute: string;
  skill: string;
}

interface VtmInsightResolverResult {
  attribute: string;
  skill: string;
  attributeValue: number;
  skillValue: number;
  score: number;
}

export function resolveVtmInsightScore(
  config: VtmInsightResolverConfig,
  characterData: Record<string, unknown>,
): VtmInsightResolverResult {
  const attributes = characterData.attributes as Record<string, number> | undefined;
  const skills = characterData.skills as Record<string, number> | undefined;
  const attributeValue = attributes?.[config.attribute] ?? 0;
  const skillValue = skills?.[config.skill] ?? 0;

  return {
    attribute: config.attribute,
    skill: config.skill,
    attributeValue,
    skillValue,
    score: attributeValue + skillValue,
  };
}

export const vtmInsightResolverSpec: RoleBlockImplementationSpec = {
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      attribute: { type: 'string', description: 'Key into characterData.attributes' },
      skill: { type: 'string', description: 'Key into characterData.skills' },
    },
    required: ['attribute', 'skill'],
  },
  defaultConfig: { attribute: '', skill: '' },
  editor: {
    columns: 2,
    fields: [
      {
        kind: 'system-stat-select',
        path: 'attribute',
        label: 'Attribute',
        statGroup: 'attributes',
        hint: 'System attribute used in the passive insight total.',
      },
      {
        kind: 'system-stat-select',
        path: 'skill',
        label: 'Skill',
        statGroup: 'skills',
        hint: 'System skill added to the passive insight total.',
      },
    ],
  },
};

export const vtmInsightResolverBlock: BlockDefinition<VtmInsightResolverConfig> = {
  type: 'insight-resolver',
  label: requirePipelineBlockSpec('insight-resolver').label,
  configSchema: vtmInsightResolverSpec.configSchema,
  execute: async (config: VtmInsightResolverConfig, ctx: BlockContext) => {
    const output = resolveVtmInsightScore(config, ctx.characterData);
    return { output, playerScore: output.score };
  },
};
