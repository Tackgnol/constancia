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

export function buildBlockRegistry(): BlockRegistry {
  const registry = new BlockRegistry();
  registry.register(outcomeMapBlock);
  registry.register(conditionalGateBlock);
  registry.register(messagePlayerBlock);
  registry.register(messageChannelBlock);
  registry.register(messageGroupBlock);
  registry.register(displayImageBlock);
  registry.register(retrieveDataBlock);
  registry.register(vtmPoolResolverBlock);
  return registry;
}
