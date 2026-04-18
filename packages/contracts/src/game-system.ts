import type { StatSchema } from './stat-schema.js';
import type { BlockDefinition } from './block.js';

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

export interface GameSystem {
  id: string;
  name: string;
  version: string;
  statSchema: StatSchema;
  testConfig: TestConfig;
  blocks: BlockDefinition[];
}
