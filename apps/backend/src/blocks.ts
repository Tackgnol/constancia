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
  BlockConfigValidationError,
  PipelineRunner,
  UnknownBlockTypeError,
} from '@constancia/core';
import type { BlockInstance, GameSystemId } from '@constancia/contracts';
import { gameSystemRegistry, listRoleBlocks } from '@constancia/systems';
import {
  PIPELINE_BLOCK,
  PIPELINE_BLOCK_SPECS,
  getEventTypeRole,
  isPipelineBlockRole,
} from '@constancia/block-catalogue';

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
const roleSpecCount = PIPELINE_BLOCK_SPECS.filter(
  (spec) => spec.availability.kind === 'role',
).length;

// Every block module sources its `label`/`configSchema` directly from the matching
// `PIPELINE_BLOCK_SPECS` entry (via `requirePipelineBlockSpec`), so those two fields can no
// longer drift between the runtime registration and the catalogue by construction. What can
// still drift is *coverage*: a block registered at runtime but missing from the catalogue (so
// it can never be added to a pipeline in the editor), or a catalogue entry with no matching
// runtime registration (so the editor could construct a pipeline the backend can't execute).
// Role blocks are implemented per Game System and registered per campaign in buildBlockRegistry.
for (const spec of PIPELINE_BLOCK_SPECS) {
  if (spec.availability.kind === 'common' && !registeredBlocksByType.has(spec.blockType)) {
    throw new Error(
      `Pipeline block catalogue lists "${spec.blockType}" but no runtime block is registered for it.`,
    );
  }
}

if (registeredBlocksByType.size !== PIPELINE_BLOCK_SPECS.length - roleSpecCount) {
  throw new Error('Pipeline block catalogue does not cover every registered block.');
}

export const registeredBlockSchemas = PIPELINE_BLOCK_SPECS.map((spec) => ({
  type: spec.blockType,
  configSchema: spec.configSchema as Record<string, unknown>,
}));

/** Builds the runtime registry for one campaign: common blocks plus its Game System's blocks and role blocks. */
export function buildBlockRegistry(gameSystemId: GameSystemId): BlockRegistry {
  const registry = new BlockRegistry();
  for (const block of commonBlocks) {
    registry.register(block as never);
  }
  const system = gameSystemRegistry.get(gameSystemId);
  for (const block of system ? [...system.blocks, ...listRoleBlocks(system)] : []) {
    registry.register(block as never);
  }
  return registry;
}

/** Returns why an Event of this type and pipeline can't run under the campaign's Game System, or null when it can. */
export function findPipelineError(
  gameSystemId: GameSystemId,
  pipeline: BlockInstance[],
  eventType: string,
): string | null {
  const registry = buildBlockRegistry(gameSystemId);
  const requiredRole = getEventTypeRole(eventType);
  if (requiredRole && !registry.get(requiredRole)) {
    return `This Game System does not support ${eventType} Events.`;
  }

  const resolverIndex = pipeline.findIndex(
    (block) => block.blockType === PIPELINE_BLOCK.TestResolver,
  );
  const modifierAfterResolver = pipeline.some(
    (block, index) =>
      block.blockType === PIPELINE_BLOCK.RollModifier &&
      resolverIndex !== -1 &&
      index > resolverIndex,
  );
  if (modifierAfterResolver) {
    return 'Put the roll modifier before the test resolver so the roll can use it.';
  }

  try {
    new PipelineRunner(registry).validate(pipeline);
    return null;
  } catch (error) {
    if (error instanceof UnknownBlockTypeError) {
      return isPipelineBlockRole(error.blockType)
        ? `This Game System does not support "${error.blockType}".`
        : error.message;
    }
    if (error instanceof BlockConfigValidationError) return error.message;
    throw error;
  }
}
