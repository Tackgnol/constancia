export { vtmPoolResolverBlock } from './vtm-v5/pool-resolver.js';
export { vtmInsightResolverBlock, resolveVtmInsightScore } from './vtm-v5/insight-resolver.js';
export * from './vtm-v5/data.js';
export * from './vtm-v5/progeny.js';
export * from './mork-borg/data.js';
export * from './stat-schemas.js';
export * from './calendar.js';
export {
  DuplicateGameSystemKeyError,
  GAME_SYSTEM_ADAPTERS,
  GameSystemRegistry,
  UnknownGameSystemError,
  buildGameSystemRegistry,
  gameSystemRegistry,
  morkBorgGameSystem,
  normalizeGameSystemLookupKey,
  vtmV5GameSystem,
} from './game-system-registry.js';
export type { GameSystemAdapter } from './game-system-registry.js';

import type { NpcSystemBlockDefinition } from '@constancia/contracts';
import { gameSystemRegistry as registeredGameSystems } from './game-system-registry.js';

export function getNpcSystemBlockDefinitions(systemId: string): NpcSystemBlockDefinition[] {
  return [...(registeredGameSystems.get(systemId)?.npcBlocks ?? [])];
}
