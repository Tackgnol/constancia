import type { BlockContext, BlockInstance } from '@constancia/contracts';
import type { BlockRegistry } from '@constancia/core';
import { PIPELINE_BLOCK } from '@constancia/block-catalogue';

interface InsightScoreResult {
  score: number;
}

/** Runs the pipeline's `insight-resolver` block for one character and returns the passive score it sets. */
export async function resolveInsightScore(
  registry: BlockRegistry,
  blocks: BlockInstance[],
  ctx: BlockContext,
): Promise<InsightScoreResult | null> {
  const instance = blocks.find((block) => block.blockType === PIPELINE_BLOCK.InsightResolver);
  const resolver = registry.get(PIPELINE_BLOCK.InsightResolver);
  if (!instance || !resolver) {
    return null;
  }

  const result = await resolver.execute(instance.config, ctx);
  return result.playerScore === undefined ? null : { score: result.playerScore };
}

export function filterInsightResolutionPipeline(blocks: BlockInstance[]): BlockInstance[] {
  const eventLevelBlocks = new Set<string>([
    PIPELINE_BLOCK.InsightResolver,
    PIPELINE_BLOCK.AddJournalEntry,
    PIPELINE_BLOCK.AddQuest,
  ]);
  return blocks.filter((block) => !eventLevelBlocks.has(block.blockType));
}
