import type { BlockInstance } from '@constancia/contracts';
import { PIPELINE_BLOCK } from '@constancia/block-catalogue';

/**
 * The stages an Event pipeline runs in:
 * - `event-wide`: journal and quest effects, once per fired Event.
 * - `insight-outcome`: everything after the insight-resolver, once per character.
 * - `test-roll`: the roll-modifier and test-resolver, only for Roll for me.
 * - `test-outcome`: what a Test submission runs with the player's score; the roll blocks and the
 *   test-card blocks (shown when the Test fires) are left out.
 */
export type PipelinePhase = 'event-wide' | 'insight-outcome' | 'test-roll' | 'test-outcome';

const EVENT_WIDE_BLOCKS = new Set<string>([
  PIPELINE_BLOCK.AddJournalEntry,
  PIPELINE_BLOCK.AddQuest,
]);
const TEST_ROLL_BLOCKS = new Set<string>([
  PIPELINE_BLOCK.RollModifier,
  PIPELINE_BLOCK.TestResolver,
]);
const TEST_CARD_BLOCKS = new Set<string>([
  PIPELINE_BLOCK.MessageChannel,
  PIPELINE_BLOCK.DisplayImage,
]);

const PHASE_FILTERS: Record<PipelinePhase, (blockType: string) => boolean> = {
  'event-wide': (blockType) => EVENT_WIDE_BLOCKS.has(blockType),
  'insight-outcome': (blockType) =>
    blockType !== PIPELINE_BLOCK.InsightResolver && !EVENT_WIDE_BLOCKS.has(blockType),
  'test-roll': (blockType) => TEST_ROLL_BLOCKS.has(blockType),
  'test-outcome': (blockType) =>
    !TEST_ROLL_BLOCKS.has(blockType) && !TEST_CARD_BLOCKS.has(blockType),
};

/** The blocks of a pipeline that run in one phase, in pipeline order. */
export function selectPipelinePhase(
  pipeline: BlockInstance[],
  phase: PipelinePhase,
): BlockInstance[] {
  return pipeline.filter((block) => PHASE_FILTERS[phase](block.blockType));
}
