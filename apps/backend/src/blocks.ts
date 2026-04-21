import {
  BlockRegistry,
  outcomeMapBlock,
  conditionalGateBlock,
  messagePlayerBlock,
  messageChannelBlock,
  messageGroupBlock,
  displayImageBlock,
  retrieveDataBlock,
} from '@constancia/core';
import { vtmPoolResolverBlock } from '@constancia/systems';

const registeredBlocks = [
  outcomeMapBlock,
  conditionalGateBlock,
  messagePlayerBlock,
  messageChannelBlock,
  messageGroupBlock,
  displayImageBlock,
  retrieveDataBlock,
  vtmPoolResolverBlock,
] as const;

export const registeredBlockSchemas = registeredBlocks.map((block) => ({
  type: block.type,
  configSchema: block.configSchema as Record<string, unknown>,
}));

export function buildBlockRegistry(): BlockRegistry {
  const registry = new BlockRegistry();
  for (const block of registeredBlocks) {
    registry.register(block as never);
  }
  return registry;
}
