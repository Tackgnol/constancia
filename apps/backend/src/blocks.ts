import {
  BlockRegistry,
  outcomeMapBlock,
  conditionalGateBlock,
  messagePlayerBlock,
  messageChannelBlock,
  messageGroupBlock,
  displayImageBlock,
  retrieveDataBlock,
  addJournalEntryBlock,
  addQuestBlock,
} from '@constancia/core';
import { gameSystemRegistry } from '@constancia/systems';
import { PIPELINE_BLOCK_SPECS } from '@constancia/block-catalogue';

const commonBlocks = [
  outcomeMapBlock,
  conditionalGateBlock,
  messagePlayerBlock,
  messageChannelBlock,
  messageGroupBlock,
  displayImageBlock,
  addJournalEntryBlock,
  addQuestBlock,
  retrieveDataBlock,
] as const;

const systemBlocks = gameSystemRegistry.list().flatMap((system) => system.blocks);
const registeredBlocks = [...commonBlocks, ...systemBlocks];

const registeredBlocksByType = new Map(registeredBlocks.map((block) => [block.type, block]));

// Every block module sources its `label`/`configSchema` directly from the matching
// `PIPELINE_BLOCK_SPECS` entry (via `requirePipelineBlockSpec`), so those two fields can no
// longer drift between the runtime registration and the catalogue by construction. What can
// still drift is *coverage*: a block registered at runtime but missing from the catalogue (so
// it can never be added to a pipeline in the editor), or a catalogue entry with no matching
// runtime registration (so the editor could construct a pipeline the backend can't execute).
for (const spec of PIPELINE_BLOCK_SPECS) {
  if (!registeredBlocksByType.has(spec.blockType)) {
    throw new Error(
      `Pipeline block catalogue lists "${spec.blockType}" but no runtime block is registered for it.`,
    );
  }
}

if (registeredBlocksByType.size !== PIPELINE_BLOCK_SPECS.length) {
  throw new Error('Pipeline block catalogue does not cover every registered block.');
}

export const registeredBlockSchemas = PIPELINE_BLOCK_SPECS.map((spec) => ({
  type: spec.blockType,
  configSchema: spec.configSchema as Record<string, unknown>,
}));

export function buildBlockRegistry(): BlockRegistry {
  const registry = new BlockRegistry();
  for (const block of registeredBlocks) {
    registry.register(block as never);
  }
  return registry;
}
