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
import { vtmInsightResolverBlock, vtmPoolResolverBlock } from '@constancia/systems';
import { PIPELINE_BLOCK_SPECS } from '@constancia/block-catalogue';

const registeredBlocks = [
  outcomeMapBlock,
  conditionalGateBlock,
  messagePlayerBlock,
  messageChannelBlock,
  messageGroupBlock,
  displayImageBlock,
  addJournalEntryBlock,
  addQuestBlock,
  retrieveDataBlock,
  vtmPoolResolverBlock,
  vtmInsightResolverBlock,
] as const;

const registeredBlocksByType = new Map(registeredBlocks.map((block) => [block.type, block]));

for (const spec of PIPELINE_BLOCK_SPECS) {
  const definition = registeredBlocksByType.get(spec.blockType);
  if (
    !definition ||
    definition.label !== spec.label ||
    JSON.stringify(definition.configSchema) !== JSON.stringify(spec.configSchema)
  ) {
    throw new Error(`Pipeline block definition drift: ${spec.blockType}`);
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
