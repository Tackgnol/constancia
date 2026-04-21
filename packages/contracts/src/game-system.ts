import type { StatSchema } from './stat-schema.js';
import type { BlockDefinition } from './block.js';
import type { NpcSystemBlockValue } from './npc.js';

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
}

export interface GameSystem {
  id: string;
  name: string;
  version: string;
  statSchema: StatSchema;
  testConfig: TestConfig;
  npcBlocks?: NpcSystemBlockDefinition[];
  blocks: BlockDefinition[];
}
