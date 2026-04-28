import type { BlockContext, BlockDefinition } from '@constancia/contracts';

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

export const vtmInsightResolverBlock: BlockDefinition<VtmInsightResolverConfig> = {
  type: 'vtm-insight-resolver',
  label: 'VTM V5 Insight Resolver',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      attribute: { type: 'string', description: 'Key into characterData.attributes' },
      skill: { type: 'string', description: 'Key into characterData.skills' },
    },
    required: ['attribute', 'skill'],
  },
  execute: async (
    config: VtmInsightResolverConfig,
    ctx: BlockContext,
  ): Promise<{
    output: VtmInsightResolverResult;
  }> => ({
    output: resolveVtmInsightScore(config, ctx.characterData),
  }),
};
