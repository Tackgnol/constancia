import type { StatSchema } from './stat-schema.js';
import type { BlockDefinition } from './block.js';
import type { NpcSystemBlockValue } from './npc.js';
import type { GameCalendarDefinition } from './game-date.js';

export interface TestConfig {
  label: string;
  fields: TestConfigField[];
}

export interface TestConfigField {
  key: string;
  label: string;
  type: 'stat-select' | 'number' | 'string';
  description?: string;
}

export interface NpcSystemBlockOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface NpcSystemBlockDefinition {
  blockType: string;
  label: string;
  description: string;
  editor: 'text' | 'textarea' | 'number' | 'select' | 'json';
  placeholder?: string;
  repeatable?: boolean;
  options?: NpcSystemBlockOption[];
  defaultValue?: NpcSystemBlockValue;
  renderVariant?: 'chip' | 'panel' | 'stats';
  /** Headline blocks show in declared order on NPC cards (the first is primary); detail blocks only in the dossier. */
  display: 'headline' | 'detail';
}

/** A character importer a Game System offers, such as Progeny for VTM. */
export interface CharacterImporter {
  id: string;
  label: string;
}

export interface ArchetypeOption {
  name: string;
  description: string;
  icon?: string;
}

/** A fixed list a Game System sorts characters into; the system's first archetype is its primary archetype. */
export interface ArchetypeDefinition {
  key: string;
  label: string;
  options: ArchetypeOption[];
}

export interface GameSystem {
  id: string;
  name: string;
  version: string;
  defaultCalendarId: string;
  calendars: Record<string, GameCalendarDefinition>;
  statSchema: StatSchema;
  archetypes: ArchetypeDefinition[];
  testConfig: TestConfig;
  npcBlocks?: NpcSystemBlockDefinition[];
  importers: CharacterImporter[];
  /** Licence credit shown wherever the system's content appears (e.g. CC-BY for an SRD). */
  attribution?: string;
  blocks: BlockDefinition[];
}
