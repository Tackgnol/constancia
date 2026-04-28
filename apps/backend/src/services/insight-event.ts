import type { BlockInstance } from '@constancia/contracts';
import { resolveVtmInsightScore } from '@constancia/systems';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface InsightScoreResult {
  score: number;
}

export function resolveInsightScore(
  blocks: BlockInstance[],
  characterData: Record<string, unknown>,
): InsightScoreResult | null {
  const resolver = blocks.find((block) => block.blockType === 'vtm-insight-resolver');
  if (!resolver || !isRecord(resolver.config)) {
    return null;
  }

  const attribute =
    typeof resolver.config.attribute === 'string' ? resolver.config.attribute.trim() : '';
  const skill = typeof resolver.config.skill === 'string' ? resolver.config.skill.trim() : '';
  if (!attribute || !skill) {
    return null;
  }

  return resolveVtmInsightScore({ attribute, skill }, characterData);
}

export function filterInsightResolutionPipeline(blocks: BlockInstance[]): BlockInstance[] {
  return blocks.filter((block) => block.blockType !== 'vtm-insight-resolver');
}
