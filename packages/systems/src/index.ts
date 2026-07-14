export { vtmPoolResolverBlock } from './vtm-v5/pool-resolver.js';
export { vtmInsightResolverBlock, resolveVtmInsightScore } from './vtm-v5/insight-resolver.js';
export * from './vtm-v5/data.js';
export * from './vtm-v5/progeny.js';
export * from './mork-borg/data.js';
export * from './stat-schemas.js';

import type { NpcSystemBlockDefinition } from '@constancia/contracts';
import { VTM_NPC_BLOCKS } from './vtm-v5/data.js';
import { MB_NPC_BLOCKS } from './mork-borg/data.js';

const NPC_BLOCK_DEFINITIONS_BY_SYSTEM: Record<string, NpcSystemBlockDefinition[]> = {
  'vtm-v5': VTM_NPC_BLOCKS,
  'mork-borg': MB_NPC_BLOCKS,
};

export function getNpcSystemBlockDefinitions(systemId: string): NpcSystemBlockDefinition[] {
  return NPC_BLOCK_DEFINITIONS_BY_SYSTEM[systemId] ?? [];
}
