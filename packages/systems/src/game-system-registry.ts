import {
  GAME_SYSTEM,
  type BlockDefinition,
  type CharacterImporter,
  type GameSystem,
  type GameSystemId,
} from '@constancia/contracts';
import { parseProgenyVtmCharacter, type ProgenyVtmSheetImport } from './vtm-v5/progeny.js';
import { MB_CLASSES, MB_NPC_BLOCKS, MB_STAT_SCHEMA } from './mork-borg/data.js';
import { VTM_CLANS, VTM_NPC_BLOCKS, VTM_STAT_SCHEMA } from './vtm-v5/data.js';
import { vtmInsightResolverBlock, vtmInsightResolverSpec } from './vtm-v5/insight-resolver.js';
import { vtmPoolHint, vtmPoolResolverBlock, vtmPoolResolverSpec } from './vtm-v5/pool-resolver.js';
import type { RoleBlockImplementations } from './role-blocks.js';
import { GREGORIAN_CALENDAR } from './calendar.js';
import {
  FIVE_E_CLASSES,
  FIVE_E_NPC_BLOCKS,
  FIVE_E_SPECIES,
  FIVE_E_STAT_SCHEMA,
  SRD_5E_ATTRIBUTION,
} from './5e-srd/data.js';
import {
  fiveEInsightResolverBlock,
  fiveEInsightResolverSpec,
  fiveEModifierHint,
  fiveERollModifierBlock,
  fiveERollModifierCardLine,
  fiveERollModifierSpec,
  fiveETestResolverBlock,
  fiveETestResolverSpec,
} from './5e-srd/resolvers.js';
import { PIPELINE_BLOCK } from '@constancia/block-catalogue';

/** A character importer with its parser; the frontend keys its import form by `id`. */
export interface CharacterImporterAdapter extends CharacterImporter {
  parse: (source: unknown) => ProgenyVtmSheetImport;
}

export interface GameSystemAdapter extends Omit<GameSystem, 'blocks' | 'importers'> {
  importers: readonly CharacterImporterAdapter[];
  aliases: readonly string[];
  /** Blocks only this system has that fill no role; their block types carry a `<systemId>-` prefix. */
  blocks: readonly BlockDefinition<never>[];
  roleBlocks: RoleBlockImplementations;
  /** How new test Events compare scores in outcome-map; 5E's "meet the DC" is gte. */
  testOutcomeComparison?: 'gt' | 'gte';
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
  private readonly systemsById = new Map<GameSystemId, GameSystemAdapter>();
  private readonly idsByLookupKey = new Map<string, GameSystemId>();

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

  /** Narrows a raw id or alias to its canonical Game System id, or undefined when none matches. */
  resolveId(systemIdOrAlias: string): GameSystemId | undefined {
    return this.get(systemIdOrAlias)?.id;
  }

  list(): readonly GameSystemAdapter[] {
    return [...this.systemsById.values()];
  }
}

export const PROGENY_IMPORTER_ID = 'progeny';

/** The system's importer with this id, if it offers one. */
export function findImporter(
  system: Pick<GameSystemAdapter, 'importers'> | undefined,
  importerId: string,
): CharacterImporterAdapter | undefined {
  return system?.importers.find((importer) => importer.id === importerId);
}

export const vtmV5GameSystem: GameSystemAdapter = {
  id: GAME_SYSTEM.VtmV5,
  aliases: [
    'vtm-5',
    'vtm5',
    'vampire-the-masquerade-5e',
    'vampire-the-masquerade-v5',
    'vampire-the-masquerade-5th-edition',
  ],
  name: 'Vampire: The Masquerade 5th Edition',
  version: '0.1.0',
  defaultCalendarId: GREGORIAN_CALENDAR.id,
  calendars: { [GREGORIAN_CALENDAR.id]: GREGORIAN_CALENDAR },
  statSchema: VTM_STAT_SCHEMA,
  archetypes: [{ key: 'clan', label: 'Clan', options: VTM_CLANS }],
  testConfig: {
    label: 'VTM V5 Test',
    fields: [
      { key: 'attribute', label: 'Attribute', type: 'stat-select' },
      { key: 'skill', label: 'Skill', type: 'stat-select' },
      { key: 'difficulty', label: 'Difficulty', type: 'number' },
    ],
  },
  npcBlocks: VTM_NPC_BLOCKS,
  importers: [{ id: PROGENY_IMPORTER_ID, label: 'Progeny', parse: parseProgenyVtmCharacter }],
  blocks: [],
  roleBlocks: {
    [PIPELINE_BLOCK.TestResolver]: {
      spec: vtmPoolResolverSpec,
      block: vtmPoolResolverBlock,
      hint: vtmPoolHint,
    },
    [PIPELINE_BLOCK.InsightResolver]: {
      spec: vtmInsightResolverSpec,
      block: vtmInsightResolverBlock,
    },
  },
};

export const morkBorgGameSystem: GameSystemAdapter = {
  id: GAME_SYSTEM.MorkBorg,
  aliases: ['morkborg'],
  name: 'Mork Borg',
  version: '0.1.0',
  defaultCalendarId: GREGORIAN_CALENDAR.id,
  calendars: { [GREGORIAN_CALENDAR.id]: GREGORIAN_CALENDAR },
  statSchema: MB_STAT_SCHEMA,
  archetypes: [{ key: 'class', label: 'Class', options: MB_CLASSES }],
  testConfig: { label: 'Mork Borg Test', fields: [] },
  npcBlocks: MB_NPC_BLOCKS,
  importers: [],
  blocks: [],
  roleBlocks: {},
};

export const fiveESrdGameSystem: GameSystemAdapter = {
  id: GAME_SYSTEM.FiveESrd,
  aliases: ['5e', 'srd-5e', 'srd-5.2.1', 'fifth-edition'],
  name: '5E (SRD 5.2.1)',
  version: '0.1.0',
  defaultCalendarId: GREGORIAN_CALENDAR.id,
  calendars: { [GREGORIAN_CALENDAR.id]: GREGORIAN_CALENDAR },
  statSchema: FIVE_E_STAT_SCHEMA,
  archetypes: [
    { key: 'class', label: 'Class', options: FIVE_E_CLASSES },
    { key: 'species', label: 'Species', options: FIVE_E_SPECIES },
  ],
  testConfig: { label: '5E Check or Save', fields: [] },
  npcBlocks: FIVE_E_NPC_BLOCKS,
  importers: [],
  attribution: SRD_5E_ATTRIBUTION,
  blocks: [],
  roleBlocks: {
    [PIPELINE_BLOCK.TestResolver]: {
      spec: fiveETestResolverSpec,
      block: fiveETestResolverBlock,
      hint: fiveEModifierHint,
    },
    [PIPELINE_BLOCK.InsightResolver]: {
      spec: fiveEInsightResolverSpec,
      block: fiveEInsightResolverBlock,
    },
    [PIPELINE_BLOCK.RollModifier]: {
      spec: fiveERollModifierSpec,
      block: fiveERollModifierBlock,
      cardLine: fiveERollModifierCardLine,
    },
  },
  testOutcomeComparison: 'gte',
};

export const GAME_SYSTEM_ADAPTERS = [
  vtmV5GameSystem,
  morkBorgGameSystem,
  fiveESrdGameSystem,
] as const satisfies readonly GameSystemAdapter[];

export function buildGameSystemRegistry(): GameSystemRegistry {
  return new GameSystemRegistry(GAME_SYSTEM_ADAPTERS);
}

export const gameSystemRegistry = buildGameSystemRegistry();
