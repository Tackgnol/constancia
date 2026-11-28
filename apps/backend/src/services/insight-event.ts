import type { BlockContext, BlockInstance } from '@constancia/contracts';
import type { BlockRegistry } from '@constancia/core';

interface InsightScoreResult {
  score: number;
}

/** Runs the pipeline's `insight-resolver` block for one character and returns the passive score it sets. */
export async function resolveInsightScore(
  registry: BlockRegistry,
  blocks: BlockInstance[],
  ctx: BlockContext,
): Promise<InsightScoreResult | null> {
  const instance = blocks.find((block) => block.blockType === 'insight-resolver');
  const resolver = registry.get('insight-resolver');
  if (!instance || !resolver) {
    return null;
  }

  const result = await resolver.execute(instance.config, ctx);
  return result.playerScore === undefined ? null : { score: result.playerScore };
}

export function filterInsightResolutionPipeline(blocks: BlockInstance[]): BlockInstance[] {
  const eventLevelBlocks = new Set(['insight-resolver', 'add-journal-entry', 'add-quest']);
  return blocks.filter((block) => !eventLevelBlocks.has(block.blockType));
}
