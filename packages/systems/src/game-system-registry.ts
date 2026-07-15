import type { BlockDefinition, GameSystem } from '@constancia/contracts';
import { MB_NPC_BLOCKS, MB_STAT_SCHEMA } from './mork-borg/data.js';
import { VTM_NPC_BLOCKS, VTM_STAT_SCHEMA } from './vtm-v5/data.js';
import { vtmInsightResolverBlock } from './vtm-v5/insight-resolver.js';
import { vtmPoolResolverBlock } from './vtm-v5/pool-resolver.js';

export interface GameSystemAdapter extends Omit<GameSystem, 'blocks'> {
  aliases: readonly string[];
  blocks: readonly BlockDefinition<never>[];
}

export class DuplicateGameSystemKeyError extends Error {
  constructor(readonly key: string) {
    super(`Game system lookup key "${key}" is already registered`);
    this.name = 'DuplicateGameSystemKeyError';
  }
}

export class UnknownGameSystemError extends Error {
  constructor(readonly systemId: string) {
    super(`Unknown game system: "${systemId}"`);
    this.name = 'UnknownGameSystemError';
  }
}

export function normalizeGameSystemLookupKey(systemId: string): string {
  return systemId
    .trim()
    .toLowerCase()
    .replace(/[\s_:]+/g, '-');
}

export class GameSystemRegistry {
  private readonly systemsById = new Map<string, GameSystemAdapter>();
  private readonly idsByLookupKey = new Map<string, string>();

  constructor(systems: readonly GameSystemAdapter[] = []) {
    for (const system of systems) {
      this.register(system);
    }
  }

  register(system: GameSystemAdapter): void {
    if (this.systemsById.has(system.id)) {
      throw new DuplicateGameSystemKeyError(system.id);
    }

    const lookupKeys = [system.id, ...system.aliases].map(normalizeGameSystemLookupKey);
    for (const lookupKey of lookupKeys) {
      if (this.idsByLookupKey.has(lookupKey)) {
        throw new DuplicateGameSystemKeyError(lookupKey);
      }
    }

    this.systemsById.set(system.id, system);
    for (const lookupKey of lookupKeys) {
      this.idsByLookupKey.set(lookupKey, system.id);
    }
  }

  get(systemIdOrAlias: string): GameSystemAdapter | undefined {
    const canonicalId = this.idsByLookupKey.get(normalizeGameSystemLookupKey(systemIdOrAlias));
    return canonicalId ? this.systemsById.get(canonicalId) : undefined;
  }

  require(systemIdOrAlias: string): GameSystemAdapter {
    const system = this.get(systemIdOrAlias);
    if (!system) {
      throw new UnknownGameSystemError(systemIdOrAlias);
    }
    return system;
  }

  resolveId(systemIdOrAlias: string): string | undefined {
    return this.get(systemIdOrAlias)?.id;
  }

  list(): readonly GameSystemAdapter[] {
    return [...this.systemsById.values()];
  }
}

export const vtmV5GameSystem: GameSystemAdapter = {
  id: 'vtm-v5',
  aliases: [
    'vtm-5',
    'vtm5',
    'vampire-the-masquerade-5e',
    'vampire-the-masquerade-v5',
    'vampire-the-masquerade-5th-edition',
  ],
  name: 'Vampire: The Masquerade 5th Edition',
  version: '0.1.0',
  statSchema: VTM_STAT_SCHEMA,
  testConfig: {
    label: 'VTM V5 Test',
    fields: [
      { key: 'attribute', label: 'Attribute', type: 'stat-select' },
      { key: 'skill', label: 'Skill', type: 'stat-select' },
      { key: 'difficulty', label: 'Difficulty', type: 'number' },
    ],
  },
  npcBlocks: VTM_NPC_BLOCKS,
  blocks: [vtmPoolResolverBlock, vtmInsightResolverBlock],
};

export const morkBorgGameSystem: GameSystemAdapter = {
  id: 'mork-borg',
  aliases: ['morkborg'],
  name: 'Mork Borg',
  version: '0.1.0',
  statSchema: MB_STAT_SCHEMA,
  testConfig: { label: 'Mork Borg Test', fields: [] },
  npcBlocks: MB_NPC_BLOCKS,
  blocks: [],
};

export const GAME_SYSTEM_ADAPTERS = [
  vtmV5GameSystem,
  morkBorgGameSystem,
] as const satisfies readonly GameSystemAdapter[];

export function buildGameSystemRegistry(): GameSystemRegistry {
  return new GameSystemRegistry(GAME_SYSTEM_ADAPTERS);
}

export const gameSystemRegistry = buildGameSystemRegistry();
