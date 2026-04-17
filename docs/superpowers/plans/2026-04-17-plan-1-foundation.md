# Plan 1: Foundation — Monorepo, Tooling, Contracts, Core, Database

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a buildable TypeScript monorepo with shared contracts, core block implementations, Prisma database schema, and full DX tooling (lint, format, hooks, tests).

**Architecture:** Turborepo monorepo with npm workspaces. `packages/contracts` defines all interfaces (zero dependencies). `packages/core` implements common blocks. `packages/db` owns Prisma schema. Apps (`apps/backend`, `apps/bot`, `apps/frontend`) are empty shells that will be built in later plans.

**Tech Stack:** TypeScript 5.x, Turborepo, ESLint 9 (flat config), Prettier, Husky, Vitest, Zod, Prisma, PostgreSQL

---

## File Structure

```
constancia/
├── package.json                          # workspace root, scripts
├── turbo.json                            # turborepo pipeline config
├── tsconfig.base.json                    # shared TS config
├── .prettierrc                           # prettier config
├── .prettierignore                       # prettier ignore
├── eslint.config.mjs                     # eslint flat config (root)
├── .husky/
│   ├── pre-commit                        # lint-staged
│   └── pre-push                          # type-check + test
├── .lintstagedrc                         # lint-staged config
├── .gitignore                            # node_modules, dist, .env, etc.
│
├── packages/
│   ├── contracts/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts                  # barrel export
│   │       ├── game-system.ts            # GameSystem interface
│   │       ├── block.ts                  # Block, BlockContext, BlockInstance, EventPipeline interfaces
│   │       ├── campaign.ts               # Campaign, Channel types
│   │       ├── character.ts              # Character, base character types
│   │       ├── npc.ts                    # NPC, NpcFact, NpcKnowledge types
│   │       ├── event.ts                  # Event, EventStatus types
│   │       ├── journal.ts               # Quest, QuestEntry, SessionSummary types
│   │       ├── auth.ts                   # CampaignAdmin, AuthContext types
│   │       └── stat-schema.ts            # StatSchema, StatField definitions
│   │
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts                  # barrel export
│   │       ├── blocks/
│   │       │   ├── message-player.ts     # MessagePlayer block
│   │       │   ├── message-channel.ts    # MessageChannel block
│   │       │   ├── message-group.ts      # MessageGroup block
│   │       │   ├── outcome-map.ts        # OutcomeMap block
│   │       │   ├── conditional-gate.ts   # ConditionalGate block
│   │       │   ├── display-image.ts      # DisplayImage block
│   │       │   └── retrieve-data.ts      # RetrieveData block
│   │       ├── pipeline-runner.ts        # executes an EventPipeline's blocks in order
│   │       └── block-registry.ts         # registers and looks up blocks by type
│   │
│   └── db/
│       ├── package.json
│       ├── tsconfig.json
│       └── prisma/
│           └── schema.prisma             # full database schema
│
├── apps/
│   ├── backend/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── bot/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/
│       ├── package.json
│       └── tsconfig.json
```

---

### Task 1: Initialize Monorepo Root

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.npmrc`

- [ ] **Step 1: Initialize package.json with workspaces**

```json
{
  "name": "constancia",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:watch": "turbo run test:watch"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5.7",
    "prettier": "^3",
    "@types/node": "^22"
  },
  "packageManager": "npm@10.9.2",
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "test:watch": {
      "cache": false,
      "persistent": true
    }
  }
}
```

- [ ] **Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "outDir": "dist",
    "rootDir": "src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "exclude": ["node_modules", "dist"]
}
```

Note: `experimentalDecorators` and `emitDecoratorMetadata` are required for tsyringe DI.

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.turbo/
.env
.env.*
!.env.example
*.local
.superpowers/
coverage/
.prisma/
```

- [ ] **Step 5: Create .npmrc**

```
engine-strict=true
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated, no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json turbo.json tsconfig.base.json .gitignore .npmrc package-lock.json
git commit -m "init: monorepo root with Turborepo and TypeScript"
```

---

### Task 2: ESLint, Prettier, Husky, lint-staged

**Files:**
- Create: `eslint.config.mjs`
- Create: `.prettierrc`
- Create: `.prettierignore`
- Create: `.lintstagedrc`
- Create: `.husky/pre-commit`
- Create: `.husky/pre-push`
- Modify: `package.json` (devDependencies)

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
npm install -D eslint @eslint/js typescript-eslint globals lint-staged husky
```

- [ ] **Step 2: Create eslint.config.mjs**

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    ignores: ["**/dist/", "**/node_modules/", "**/.turbo/", "**/coverage/"],
  }
);
```

- [ ] **Step 3: Create .prettierrc**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 4: Create .prettierignore**

```
node_modules
dist
.turbo
coverage
package-lock.json
pnpm-lock.yaml
*.prisma
```

- [ ] **Step 5: Create .lintstagedrc**

```json
{
  "*.{ts,tsx,mjs}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
```

- [ ] **Step 6: Initialize Husky and create hooks**

Run:
```bash
npx husky init
```

Then overwrite `.husky/pre-commit`:

```bash
npx lint-staged
```

Create `.husky/pre-push`:

```bash
npm run typecheck
npm run test
```

- [ ] **Step 7: Add lint script to root package.json**

Add to `"scripts"` in `package.json`:

```json
"lint:root": "eslint ."
```

- [ ] **Step 8: Verify setup**

Run: `npx prettier --check .`
Expected: All files pass (or only auto-generated files flagged).

Run: `npx eslint .`
Expected: No errors (no source files yet).

- [ ] **Step 9: Commit**

```bash
git add eslint.config.mjs .prettierrc .prettierignore .lintstagedrc .husky/ package.json package-lock.json
git commit -m "init: ESLint 9 flat config, Prettier, Husky, lint-staged"
```

---

### Task 3: packages/contracts — Interfaces and Types

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/vitest.config.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/stat-schema.ts`
- Create: `packages/contracts/src/block.ts`
- Create: `packages/contracts/src/game-system.ts`
- Create: `packages/contracts/src/campaign.ts`
- Create: `packages/contracts/src/character.ts`
- Create: `packages/contracts/src/npc.ts`
- Create: `packages/contracts/src/event.ts`
- Create: `packages/contracts/src/journal.ts`
- Create: `packages/contracts/src/auth.ts`
- Test: `packages/contracts/src/__tests__/types.test.ts`

- [ ] **Step 1: Create packages/contracts/package.json**

```json
{
  "name": "@constancia/contracts",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "test": "vitest run",
    "test:watch": "vitest watch"
  },
  "devDependencies": {
    "vitest": "^3"
  }
}
```

- [ ] **Step 2: Create packages/contracts/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/contracts/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 4: Install vitest in contracts package**

Run:
```bash
cd packages/contracts && npm install -D vitest && cd ../..
```

- [ ] **Step 5: Create packages/contracts/src/stat-schema.ts**

```typescript
export interface StatField {
  key: string;
  label: string;
  type: 'number' | 'string' | 'boolean';
  min?: number;
  max?: number;
  defaultValue?: number | string | boolean;
}

export interface StatGroup {
  key: string;
  label: string;
  fields: StatField[];
}

export interface StatSchema {
  groups: StatGroup[];
}
```

- [ ] **Step 6: Create packages/contracts/src/block.ts**

```typescript
import type { JSONSchema7 } from 'json-schema';

export interface BlockContext {
  campaignId: string;
  channelId: string;
  playerId: string;
  playerScore?: number;
  characterData: Record<string, unknown>;
}

export interface BlockDefinition<TConfig = unknown> {
  type: string;
  label: string;
  configSchema: JSONSchema7;
  execute: (config: TConfig, ctx: BlockContext) => Promise<BlockResult>;
}

export interface BlockResult {
  output: unknown;
  messages?: BlockMessage[];
  halt?: boolean;
}

export interface BlockMessage {
  target: 'player' | 'channel' | 'group';
  targetId?: string;
  content: string;
  imageUrl?: string;
}

export interface BlockInstance {
  blockType: string;
  config: Record<string, unknown>;
}

export interface EventPipeline {
  id: string;
  name: string;
  gameSystemId: string;
  blocks: BlockInstance[];
  shortCircuit: boolean;
}
```

- [ ] **Step 7: Create packages/contracts/src/game-system.ts**

```typescript
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
```

- [ ] **Step 8: Create packages/contracts/src/campaign.ts**

```typescript
export type ChannelType = 'main' | 'scene' | 'temp';

export interface Campaign {
  id: string;
  name: string;
  discordGuildId: string;
  gameSystemId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Channel {
  id: string;
  name: string;
  discordChannelId: string;
  campaignId: string;
  type: ChannelType;
  createdAt: Date;
}
```

- [ ] **Step 9: Create packages/contracts/src/character.ts**

```typescript
export interface Character {
  id: string;
  name: string;
  backstory: string;
  notes: string;
  discordUserId: string;
  campaignId: string;
  systemData: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 10: Create packages/contracts/src/npc.ts**

```typescript
export interface Npc {
  id: string;
  name: string;
  imageUrl?: string;
  description: string;
  campaignId: string;
  createdAt: Date;
}

export interface NpcFact {
  id: string;
  content: string;
  sortOrder: number;
  npcId: string;
}

export interface NpcKnowledge {
  characterId: string;
  npcFactId: string;
  revealedAt: Date;
}
```

- [ ] **Step 11: Create packages/contracts/src/event.ts**

```typescript
import type { BlockInstance } from './block.js';

export type EventStatus = 'draft' | 'ready' | 'fired' | 'archived';

export interface GameEvent {
  id: string;
  name: string;
  type: string;
  channelId: string;
  campaignId: string;
  pipeline: BlockInstance[];
  status: EventStatus;
  shortCircuit: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 12: Create packages/contracts/src/journal.ts**

```typescript
export type QuestStatus = 'active' | 'completed' | 'failed';
export type QuestEntryStatus = 'pending' | 'done';

export interface Quest {
  id: string;
  name: string;
  description: string;
  campaignId: string;
  status: QuestStatus;
  sortOrder: number;
  visible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestEntry {
  id: string;
  content: string;
  questId: string;
  status: QuestEntryStatus;
  sortOrder: number;
  createdAt: Date;
}

export interface SessionSummary {
  id: string;
  title: string;
  content: string;
  campaignId: string;
  sessionDate: Date;
  visible: boolean;
  channelId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 13: Create packages/contracts/src/auth.ts**

```typescript
export type AdminRole = 'owner' | 'gm';

export interface CampaignAdmin {
  id: string;
  discordUserId: string;
  campaignId: string;
  role: AdminRole;
}

export interface AuthContext {
  userId: string;
  discordUserId: string;
  campaigns: { campaignId: string; role: AdminRole }[];
}
```

- [ ] **Step 14: Create packages/contracts/src/index.ts**

```typescript
export type {
  StatField,
  StatGroup,
  StatSchema,
} from './stat-schema.js';

export type {
  BlockContext,
  BlockDefinition,
  BlockResult,
  BlockMessage,
  BlockInstance,
  EventPipeline,
} from './block.js';

export type {
  TestConfig,
  TestConfigField,
  GameSystem,
} from './game-system.js';

export type {
  Campaign,
  Channel,
  ChannelType,
} from './campaign.js';

export type { Character } from './character.js';

export type {
  Npc,
  NpcFact,
  NpcKnowledge,
} from './npc.js';

export type {
  GameEvent,
  EventStatus,
} from './event.js';

export type {
  Quest,
  QuestEntry,
  QuestEntryStatus,
  QuestStatus,
  SessionSummary,
} from './journal.js';

export type {
  CampaignAdmin,
  AdminRole,
  AuthContext,
} from './auth.js';
```

- [ ] **Step 15: Write type verification test**

Create `packages/contracts/src/__tests__/types.test.ts`:

```typescript
import { describe, it, expectTypeOf } from 'vitest';
import type {
  GameSystem,
  BlockDefinition,
  BlockContext,
  BlockResult,
  Character,
  GameEvent,
  EventPipeline,
  Quest,
  QuestEntry,
  SessionSummary,
} from '../index.js';

describe('Contract types', () => {
  it('GameSystem has required properties', () => {
    expectTypeOf<GameSystem>().toHaveProperty('id');
    expectTypeOf<GameSystem>().toHaveProperty('name');
    expectTypeOf<GameSystem>().toHaveProperty('version');
    expectTypeOf<GameSystem>().toHaveProperty('statSchema');
    expectTypeOf<GameSystem>().toHaveProperty('testConfig');
    expectTypeOf<GameSystem>().toHaveProperty('blocks');
  });

  it('BlockDefinition has execute method', () => {
    expectTypeOf<BlockDefinition>().toHaveProperty('execute');
    expectTypeOf<BlockDefinition['execute']>().toBeFunction();
  });

  it('BlockContext carries player score optionally', () => {
    expectTypeOf<BlockContext>().toHaveProperty('playerScore');
    expectTypeOf<BlockContext['playerScore']>().toEqualTypeOf<number | undefined>();
  });

  it('Character systemData is a flexible record', () => {
    expectTypeOf<Character['systemData']>().toEqualTypeOf<Record<string, unknown>>();
  });

  it('GameEvent pipeline is an array of BlockInstance', () => {
    expectTypeOf<GameEvent['pipeline']>().toBeArray();
  });

  it('Quest has correct status union', () => {
    expectTypeOf<Quest['status']>().toEqualTypeOf<'active' | 'completed' | 'failed'>();
  });

  it('QuestEntry has correct status union', () => {
    expectTypeOf<QuestEntry['status']>().toEqualTypeOf<'pending' | 'done'>();
  });

  it('SessionSummary channelId is optional', () => {
    expectTypeOf<SessionSummary['channelId']>().toEqualTypeOf<string | undefined>();
  });
});
```

- [ ] **Step 16: Install json-schema types**

Run:
```bash
cd packages/contracts && npm install -D @types/json-schema && cd ../..
```

- [ ] **Step 17: Build and test**

Run: `npm run build --workspace=packages/contracts`
Expected: `packages/contracts/dist/` created with .js and .d.ts files.

Run: `npm run test --workspace=packages/contracts`
Expected: All type tests pass.

- [ ] **Step 18: Commit**

```bash
git add packages/contracts/
git commit -m "feat: add contracts package with all shared interfaces and types"
```

---

### Task 4: packages/core — Block Registry and Pipeline Runner

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/block-registry.ts`
- Create: `packages/core/src/pipeline-runner.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/src/__tests__/block-registry.test.ts`
- Test: `packages/core/src/__tests__/pipeline-runner.test.ts`

- [ ] **Step 1: Create packages/core/package.json**

```json
{
  "name": "@constancia/core",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "test": "vitest run",
    "test:watch": "vitest watch"
  },
  "dependencies": {
    "@constancia/contracts": "*"
  },
  "devDependencies": {
    "vitest": "^3"
  }
}
```

- [ ] **Step 2: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [
    { "path": "../contracts" }
  ]
}
```

- [ ] **Step 3: Create packages/core/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 4: Install vitest**

Run:
```bash
cd packages/core && npm install -D vitest && cd ../..
```

- [ ] **Step 5: Write failing test for BlockRegistry**

Create `packages/core/src/__tests__/block-registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BlockRegistry } from '../block-registry.js';
import type { BlockDefinition, BlockContext, BlockResult } from '@constancia/contracts';

const mockBlock: BlockDefinition<{ message: string }> = {
  type: 'test-block',
  label: 'Test Block',
  configSchema: { type: 'object' },
  execute: async (config) => ({
    output: config.message,
    messages: [],
  }),
};

describe('BlockRegistry', () => {
  it('registers and retrieves a block by type', () => {
    const registry = new BlockRegistry();
    registry.register(mockBlock);
    const found = registry.get('test-block');
    expect(found).toBe(mockBlock);
  });

  it('returns undefined for unknown block type', () => {
    const registry = new BlockRegistry();
    const found = registry.get('nonexistent');
    expect(found).toBeUndefined();
  });

  it('lists all registered block types', () => {
    const registry = new BlockRegistry();
    registry.register(mockBlock);
    registry.register({ ...mockBlock, type: 'another-block', label: 'Another' });
    expect(registry.listTypes()).toEqual(['test-block', 'another-block']);
  });

  it('throws on duplicate registration', () => {
    const registry = new BlockRegistry();
    registry.register(mockBlock);
    expect(() => registry.register(mockBlock)).toThrow('already registered');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test --workspace=packages/core`
Expected: FAIL — `block-registry.js` does not exist.

- [ ] **Step 7: Implement BlockRegistry**

Create `packages/core/src/block-registry.ts`:

```typescript
import type { BlockDefinition } from '@constancia/contracts';

export class BlockRegistry {
  private blocks = new Map<string, BlockDefinition>();

  register(block: BlockDefinition): void {
    if (this.blocks.has(block.type)) {
      throw new Error(`Block type "${block.type}" is already registered`);
    }
    this.blocks.set(block.type, block);
  }

  get(type: string): BlockDefinition | undefined {
    return this.blocks.get(type);
  }

  listTypes(): string[] {
    return [...this.blocks.keys()];
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test --workspace=packages/core`
Expected: All BlockRegistry tests pass.

- [ ] **Step 9: Write failing test for PipelineRunner**

Create `packages/core/src/__tests__/pipeline-runner.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { PipelineRunner } from '../pipeline-runner.js';
import { BlockRegistry } from '../block-registry.js';
import type {
  BlockDefinition,
  BlockContext,
  BlockInstance,
  BlockMessage,
} from '@constancia/contracts';

function createContext(overrides?: Partial<BlockContext>): BlockContext {
  return {
    campaignId: 'campaign-1',
    channelId: 'channel-1',
    playerId: 'player-1',
    characterData: {},
    ...overrides,
  };
}

describe('PipelineRunner', () => {
  it('executes blocks in order and collects messages', async () => {
    const registry = new BlockRegistry();

    const block1: BlockDefinition<{ text: string }> = {
      type: 'say',
      label: 'Say',
      configSchema: { type: 'object' },
      execute: async (config) => ({
        output: config.text,
        messages: [{ target: 'player' as const, content: config.text }],
      }),
    };

    registry.register(block1);

    const runner = new PipelineRunner(registry);
    const blocks: BlockInstance[] = [
      { blockType: 'say', config: { text: 'Hello' } },
      { blockType: 'say', config: { text: 'World' } },
    ];

    const result = await runner.run(blocks, createContext());
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].content).toBe('Hello');
    expect(result.messages[1].content).toBe('World');
  });

  it('halts pipeline when a block sets halt: true', async () => {
    const registry = new BlockRegistry();

    const gateBlock: BlockDefinition<{ pass: boolean }> = {
      type: 'gate',
      label: 'Gate',
      configSchema: { type: 'object' },
      execute: async (config) => ({
        output: null,
        halt: !config.pass,
      }),
    };

    const sayBlock: BlockDefinition<{ text: string }> = {
      type: 'say',
      label: 'Say',
      configSchema: { type: 'object' },
      execute: async (config) => ({
        output: config.text,
        messages: [{ target: 'player' as const, content: config.text }],
      }),
    };

    registry.register(gateBlock);
    registry.register(sayBlock);

    const runner = new PipelineRunner(registry);
    const blocks: BlockInstance[] = [
      { blockType: 'gate', config: { pass: false } },
      { blockType: 'say', config: { text: 'Should not appear' } },
    ];

    const result = await runner.run(blocks, createContext());
    expect(result.messages).toHaveLength(0);
    expect(result.halted).toBe(true);
  });

  it('throws on unknown block type', async () => {
    const registry = new BlockRegistry();
    const runner = new PipelineRunner(registry);
    const blocks: BlockInstance[] = [
      { blockType: 'nonexistent', config: {} },
    ];

    await expect(runner.run(blocks, createContext())).rejects.toThrow(
      'Unknown block type: "nonexistent"',
    );
  });

  it('passes context through to blocks', async () => {
    const registry = new BlockRegistry();
    const executeSpy = vi.fn(async () => ({ output: null }));

    const block: BlockDefinition = {
      type: 'spy',
      label: 'Spy',
      configSchema: { type: 'object' },
      execute: executeSpy,
    };

    registry.register(block);

    const runner = new PipelineRunner(registry);
    const ctx = createContext({ playerScore: 5 });

    await runner.run([{ blockType: 'spy', config: { key: 'val' } }], ctx);

    expect(executeSpy).toHaveBeenCalledWith({ key: 'val' }, ctx);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm run test --workspace=packages/core`
Expected: FAIL — `pipeline-runner.js` does not exist.

- [ ] **Step 11: Implement PipelineRunner**

Create `packages/core/src/pipeline-runner.ts`:

```typescript
import type { BlockContext, BlockInstance, BlockMessage } from '@constancia/contracts';
import type { BlockRegistry } from './block-registry.js';

export interface PipelineResult {
  messages: BlockMessage[];
  outputs: unknown[];
  halted: boolean;
}

export class PipelineRunner {
  constructor(private registry: BlockRegistry) {}

  async run(blocks: BlockInstance[], ctx: BlockContext): Promise<PipelineResult> {
    const messages: BlockMessage[] = [];
    const outputs: unknown[] = [];

    for (const instance of blocks) {
      const block = this.registry.get(instance.blockType);
      if (!block) {
        throw new Error(`Unknown block type: "${instance.blockType}"`);
      }

      const result = await block.execute(instance.config, ctx);
      outputs.push(result.output);

      if (result.messages) {
        messages.push(...result.messages);
      }

      if (result.halt) {
        return { messages, outputs, halted: true };
      }
    }

    return { messages, outputs, halted: false };
  }
}
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `npm run test --workspace=packages/core`
Expected: All BlockRegistry and PipelineRunner tests pass.

- [ ] **Step 13: Create packages/core/src/index.ts**

```typescript
export { BlockRegistry } from './block-registry.js';
export { PipelineRunner } from './pipeline-runner.js';
export type { PipelineResult } from './pipeline-runner.js';
```

- [ ] **Step 14: Build**

Run: `npm run build --workspace=packages/contracts && npm run build --workspace=packages/core`
Expected: Both build successfully.

- [ ] **Step 15: Commit**

```bash
git add packages/core/
git commit -m "feat: add core package with BlockRegistry and PipelineRunner"
```

---

### Task 5: packages/core — Common Block Implementations

**Files:**
- Create: `packages/core/src/blocks/outcome-map.ts`
- Create: `packages/core/src/blocks/conditional-gate.ts`
- Create: `packages/core/src/blocks/message-player.ts`
- Create: `packages/core/src/blocks/message-channel.ts`
- Create: `packages/core/src/blocks/message-group.ts`
- Create: `packages/core/src/blocks/display-image.ts`
- Create: `packages/core/src/blocks/retrieve-data.ts`
- Test: `packages/core/src/__tests__/blocks/outcome-map.test.ts`
- Test: `packages/core/src/__tests__/blocks/conditional-gate.test.ts`
- Test: `packages/core/src/__tests__/blocks/message-player.test.ts`

- [ ] **Step 1: Write failing test for OutcomeMap**

Create `packages/core/src/__tests__/blocks/outcome-map.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { outcomeMapBlock } from '../../blocks/outcome-map.js';
import type { BlockContext } from '@constancia/contracts';

const ctx: BlockContext = {
  campaignId: 'c1',
  channelId: 'ch1',
  playerId: 'p1',
  playerScore: 3,
  characterData: {},
};

describe('OutcomeMap block', () => {
  it('returns the matching outcome for exact score', async () => {
    const config = {
      outcomes: [
        { minScore: 0, maxScore: 0, text: 'Critical failure' },
        { minScore: 1, maxScore: 2, text: 'Partial success' },
        { minScore: 3, maxScore: 5, text: 'Full success' },
      ],
    };

    const result = await outcomeMapBlock.execute(config, ctx);
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0].content).toBe('Full success');
    expect(result.messages![0].target).toBe('player');
  });

  it('returns no messages when no outcome matches', async () => {
    const config = {
      outcomes: [
        { minScore: 5, maxScore: 10, text: 'Very high' },
      ],
    };

    const result = await outcomeMapBlock.execute(config, ctx);
    expect(result.messages).toHaveLength(0);
  });

  it('short-circuits: returns only the closest matching outcome', async () => {
    const config = {
      outcomes: [
        { minScore: 0, maxScore: 1, text: 'Fail' },
        { minScore: 2, maxScore: 3, text: 'Partial' },
        { minScore: 4, maxScore: 6, text: 'Full' },
      ],
      shortCircuit: true,
    };

    const ctxWith2 = { ...ctx, playerScore: 2 };
    const result = await outcomeMapBlock.execute(config, ctxWith2);
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0].content).toBe('Partial');
  });

  it('non-short-circuit: returns all outcomes up to score', async () => {
    const config = {
      outcomes: [
        { minScore: 0, maxScore: 1, text: 'Fail' },
        { minScore: 2, maxScore: 3, text: 'Partial' },
        { minScore: 4, maxScore: 6, text: 'Full' },
      ],
      shortCircuit: false,
    };

    const ctxWith5 = { ...ctx, playerScore: 5 };
    const result = await outcomeMapBlock.execute(config, ctxWith5);
    expect(result.messages).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/core`
Expected: FAIL — `outcome-map.js` does not exist.

- [ ] **Step 3: Implement OutcomeMap**

Create `packages/core/src/blocks/outcome-map.ts`:

```typescript
import type { BlockDefinition, BlockMessage } from '@constancia/contracts';

interface Outcome {
  minScore: number;
  maxScore: number;
  text: string;
}

interface OutcomeMapConfig {
  outcomes: Outcome[];
  shortCircuit?: boolean;
}

export const outcomeMapBlock: BlockDefinition<OutcomeMapConfig> = {
  type: 'outcome-map',
  label: 'Outcome Map',
  configSchema: {
    type: 'object',
    properties: {
      outcomes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            minScore: { type: 'number' },
            maxScore: { type: 'number' },
            text: { type: 'string' },
          },
          required: ['minScore', 'maxScore', 'text'],
        },
      },
      shortCircuit: { type: 'boolean' },
    },
    required: ['outcomes'],
  },
  execute: async (config, ctx) => {
    const score = ctx.playerScore ?? 0;
    const messages: BlockMessage[] = [];

    const sorted = [...config.outcomes].sort((a, b) => a.minScore - b.minScore);

    for (const outcome of sorted) {
      if (score >= outcome.minScore && score <= outcome.maxScore) {
        messages.push({ target: 'player', content: outcome.text });
        if (config.shortCircuit) {
          break;
        }
      } else if (!config.shortCircuit && score > outcome.maxScore) {
        messages.push({ target: 'player', content: outcome.text });
      }
    }

    return { output: { score, matchedCount: messages.length }, messages };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=packages/core`
Expected: All OutcomeMap tests pass.

- [ ] **Step 5: Write failing test for ConditionalGate**

Create `packages/core/src/__tests__/blocks/conditional-gate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { conditionalGateBlock } from '../../blocks/conditional-gate.js';
import type { BlockContext } from '@constancia/contracts';

describe('ConditionalGate block', () => {
  it('passes when stat meets threshold', async () => {
    const ctx: BlockContext = {
      campaignId: 'c1',
      channelId: 'ch1',
      playerId: 'p1',
      characterData: { occult: 4 },
    };

    const config = { statPath: 'occult', operator: 'gte' as const, threshold: 4 };
    const result = await conditionalGateBlock.execute(config, ctx);
    expect(result.halt).toBeFalsy();
  });

  it('halts when stat below threshold', async () => {
    const ctx: BlockContext = {
      campaignId: 'c1',
      channelId: 'ch1',
      playerId: 'p1',
      characterData: { occult: 2 },
    };

    const config = { statPath: 'occult', operator: 'gte' as const, threshold: 4 };
    const result = await conditionalGateBlock.execute(config, ctx);
    expect(result.halt).toBe(true);
  });

  it('supports nested stat paths', async () => {
    const ctx: BlockContext = {
      campaignId: 'c1',
      channelId: 'ch1',
      playerId: 'p1',
      characterData: { attributes: { wits: 3 } },
    };

    const config = { statPath: 'attributes.wits', operator: 'gte' as const, threshold: 3 };
    const result = await conditionalGateBlock.execute(config, ctx);
    expect(result.halt).toBeFalsy();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test --workspace=packages/core`
Expected: FAIL — `conditional-gate.js` does not exist.

- [ ] **Step 7: Implement ConditionalGate**

Create `packages/core/src/blocks/conditional-gate.ts`:

```typescript
import type { BlockDefinition } from '@constancia/contracts';

type Operator = 'gte' | 'gt' | 'lte' | 'lt' | 'eq';

interface ConditionalGateConfig {
  statPath: string;
  operator: Operator;
  threshold: number;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

const operators: Record<Operator, (value: number, threshold: number) => boolean> = {
  gte: (v, t) => v >= t,
  gt: (v, t) => v > t,
  lte: (v, t) => v <= t,
  lt: (v, t) => v < t,
  eq: (v, t) => v === t,
};

export const conditionalGateBlock: BlockDefinition<ConditionalGateConfig> = {
  type: 'conditional-gate',
  label: 'Conditional Gate',
  configSchema: {
    type: 'object',
    properties: {
      statPath: { type: 'string' },
      operator: { type: 'string', enum: ['gte', 'gt', 'lte', 'lt', 'eq'] },
      threshold: { type: 'number' },
    },
    required: ['statPath', 'operator', 'threshold'],
  },
  execute: async (config, ctx) => {
    const value = getNestedValue(ctx.characterData, config.statPath);
    const numValue = typeof value === 'number' ? value : 0;
    const pass = operators[config.operator](numValue, config.threshold);

    return { output: { pass, value: numValue }, halt: !pass };
  },
};
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test --workspace=packages/core`
Expected: All ConditionalGate tests pass.

- [ ] **Step 9: Implement message blocks**

Create `packages/core/src/blocks/message-player.ts`:

```typescript
import type { BlockDefinition } from '@constancia/contracts';

interface MessagePlayerConfig {
  content: string;
  imageUrl?: string;
}

export const messagePlayerBlock: BlockDefinition<MessagePlayerConfig> = {
  type: 'message-player',
  label: 'Message Player',
  configSchema: {
    type: 'object',
    properties: {
      content: { type: 'string' },
      imageUrl: { type: 'string' },
    },
    required: ['content'],
  },
  execute: async (config) => ({
    output: null,
    messages: [
      {
        target: 'player',
        content: config.content,
        imageUrl: config.imageUrl,
      },
    ],
  }),
};
```

Create `packages/core/src/blocks/message-channel.ts`:

```typescript
import type { BlockDefinition } from '@constancia/contracts';

interface MessageChannelConfig {
  content: string;
  imageUrl?: string;
}

export const messageChannelBlock: BlockDefinition<MessageChannelConfig> = {
  type: 'message-channel',
  label: 'Message Channel',
  configSchema: {
    type: 'object',
    properties: {
      content: { type: 'string' },
      imageUrl: { type: 'string' },
    },
    required: ['content'],
  },
  execute: async (config) => ({
    output: null,
    messages: [
      {
        target: 'channel',
        content: config.content,
        imageUrl: config.imageUrl,
      },
    ],
  }),
};
```

Create `packages/core/src/blocks/message-group.ts`:

```typescript
import type { BlockDefinition } from '@constancia/contracts';

interface MessageGroupConfig {
  content: string;
  imageUrl?: string;
  groupPlayerIds?: string[];
}

export const messageGroupBlock: BlockDefinition<MessageGroupConfig> = {
  type: 'message-group',
  label: 'Message Group',
  configSchema: {
    type: 'object',
    properties: {
      content: { type: 'string' },
      imageUrl: { type: 'string' },
      groupPlayerIds: { type: 'array', items: { type: 'string' } },
    },
    required: ['content'],
  },
  execute: async (config) => ({
    output: null,
    messages: [
      {
        target: 'group',
        content: config.content,
        imageUrl: config.imageUrl,
      },
    ],
  }),
};
```

Create `packages/core/src/blocks/display-image.ts`:

```typescript
import type { BlockDefinition } from '@constancia/contracts';

interface DisplayImageConfig {
  imageUrl: string;
  caption?: string;
}

export const displayImageBlock: BlockDefinition<DisplayImageConfig> = {
  type: 'display-image',
  label: 'Display Image',
  configSchema: {
    type: 'object',
    properties: {
      imageUrl: { type: 'string' },
      caption: { type: 'string' },
    },
    required: ['imageUrl'],
  },
  execute: async (config) => ({
    output: null,
    messages: [
      {
        target: 'channel',
        content: config.caption ?? '',
        imageUrl: config.imageUrl,
      },
    ],
  }),
};
```

Create `packages/core/src/blocks/retrieve-data.ts`:

```typescript
import type { BlockDefinition } from '@constancia/contracts';

interface RetrieveDataConfig {
  dataType: string;
  query?: Record<string, unknown>;
}

export const retrieveDataBlock: BlockDefinition<RetrieveDataConfig> = {
  type: 'retrieve-data',
  label: 'Retrieve Data',
  configSchema: {
    type: 'object',
    properties: {
      dataType: { type: 'string' },
      query: { type: 'object' },
    },
    required: ['dataType'],
  },
  execute: async (config, ctx) => ({
    output: {
      dataType: config.dataType,
      query: config.query,
      characterData: ctx.characterData,
    },
  }),
};
```

- [ ] **Step 10: Write test for MessagePlayer block**

Create `packages/core/src/__tests__/blocks/message-player.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { messagePlayerBlock } from '../../blocks/message-player.js';
import type { BlockContext } from '@constancia/contracts';

const ctx: BlockContext = {
  campaignId: 'c1',
  channelId: 'ch1',
  playerId: 'p1',
  characterData: {},
};

describe('MessagePlayer block', () => {
  it('sends a message targeted at player', async () => {
    const result = await messagePlayerBlock.execute({ content: 'Hello player' }, ctx);
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0].target).toBe('player');
    expect(result.messages![0].content).toBe('Hello player');
  });

  it('includes imageUrl when provided', async () => {
    const result = await messagePlayerBlock.execute(
      { content: 'Look', imageUrl: 'http://img.png' },
      ctx,
    );
    expect(result.messages![0].imageUrl).toBe('http://img.png');
  });
});
```

- [ ] **Step 11: Run all tests**

Run: `npm run test --workspace=packages/core`
Expected: All tests pass.

- [ ] **Step 12: Update packages/core/src/index.ts**

```typescript
export { BlockRegistry } from './block-registry.js';
export { PipelineRunner } from './pipeline-runner.js';
export type { PipelineResult } from './pipeline-runner.js';

export { outcomeMapBlock } from './blocks/outcome-map.js';
export { conditionalGateBlock } from './blocks/conditional-gate.js';
export { messagePlayerBlock } from './blocks/message-player.js';
export { messageChannelBlock } from './blocks/message-channel.js';
export { messageGroupBlock } from './blocks/message-group.js';
export { displayImageBlock } from './blocks/display-image.js';
export { retrieveDataBlock } from './blocks/retrieve-data.js';
```

- [ ] **Step 13: Build**

Run: `npm run build --workspace=packages/contracts && npm run build --workspace=packages/core`
Expected: Both build successfully.

- [ ] **Step 14: Commit**

```bash
git add packages/core/
git commit -m "feat: add common blocks — OutcomeMap, ConditionalGate, message blocks, DisplayImage, RetrieveData"
```

---

### Task 6: packages/db — Prisma Schema

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `.env.example`

- [ ] **Step 1: Create packages/db/package.json**

```json
{
  "name": "@constancia/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "prisma generate && tsc",
    "typecheck": "tsc --noEmit",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^6"
  },
  "devDependencies": {
    "prisma": "^6"
  }
}
```

- [ ] **Step 2: Create packages/db/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/db/src/index.ts**

```typescript
export { PrismaClient } from '@prisma/client';
export type * from '@prisma/client';
```

- [ ] **Step 4: Create packages/db/prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Campaign ───────────────────────────────────────────

model Campaign {
  id             String   @id @default(cuid())
  name           String
  discordGuildId String   @unique
  gameSystemId   String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  channels  Channel[]
  characters Character[]
  npcs       Npc[]
  admins     CampaignAdmin[]
  events     Event[]
  quests     Quest[]
  summaries  SessionSummary[]

  @@map("campaigns")
}

// ─── Channel ────────────────────────────────────────────

model Channel {
  id               String   @id @default(cuid())
  name             String
  discordChannelId String   @unique
  campaignId       String
  type             ChannelType @default(main)
  createdAt        DateTime @default(now())

  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  events   Event[]
  summaries SessionSummary[]

  @@map("channels")
}

enum ChannelType {
  main
  scene
  temp
}

// ─── Character ──────────────────────────────────────────

model Character {
  id            String   @id @default(cuid())
  name          String
  backstory     String   @default("")
  notes         String   @default("")
  discordUserId String
  campaignId    String
  systemData    Json     @default("{}")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  campaign     Campaign       @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  npcKnowledge NpcKnowledge[]

  @@unique([discordUserId, campaignId])
  @@map("characters")
}

// ─── NPC ────────────────────────────────────────────────

model Npc {
  id          String   @id @default(cuid())
  name        String
  imageUrl    String?
  description String   @default("")
  campaignId  String
  createdAt   DateTime @default(now())

  campaign Campaign  @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  facts    NpcFact[]

  @@map("npcs")
}

model NpcFact {
  id        String @id @default(cuid())
  content   String
  sortOrder Int    @default(0)
  npcId     String

  npc       Npc            @relation(fields: [npcId], references: [id], onDelete: Cascade)
  knowledge NpcKnowledge[]

  @@map("npc_facts")
}

model NpcKnowledge {
  characterId String
  npcFactId   String
  revealedAt  DateTime @default(now())

  character Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
  npcFact   NpcFact   @relation(fields: [npcFactId], references: [id], onDelete: Cascade)

  @@id([characterId, npcFactId])
  @@map("npc_knowledge")
}

// ─── Event ──────────────────────────────────────────────

model Event {
  id           String      @id @default(cuid())
  name         String
  type         String
  channelId    String
  campaignId   String
  pipeline     Json        @default("[]")
  status       EventStatus @default(draft)
  shortCircuit Boolean     @default(false)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  channel  Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@map("events")
}

enum EventStatus {
  draft
  ready
  fired
  archived
}

// ─── Journal ────────────────────────────────────────────

model Quest {
  id          String      @id @default(cuid())
  name        String
  description String      @default("")
  campaignId  String
  status      QuestStatus @default(active)
  sortOrder   Int         @default(0)
  visible     Boolean     @default(false)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  campaign Campaign     @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  entries  QuestEntry[]

  @@map("quests")
}

enum QuestStatus {
  active
  completed
  failed
}

model QuestEntry {
  id        String           @id @default(cuid())
  content   String
  questId   String
  status    QuestEntryStatus @default(pending)
  sortOrder Int              @default(0)
  createdAt DateTime         @default(now())

  quest Quest @relation(fields: [questId], references: [id], onDelete: Cascade)

  @@map("quest_entries")
}

enum QuestEntryStatus {
  pending
  done
}

model SessionSummary {
  id          String   @id @default(cuid())
  title       String
  content     String
  campaignId  String
  sessionDate DateTime
  visible     Boolean  @default(false)
  channelId   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  channel  Channel? @relation(fields: [channelId], references: [id])

  @@map("session_summaries")
}

// ─── Auth ───────────────────────────────────────────────

model CampaignAdmin {
  id            String    @id @default(cuid())
  discordUserId String
  campaignId    String
  role          AdminRole @default(gm)

  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@unique([discordUserId, campaignId])
  @@map("campaign_admins")
}

enum AdminRole {
  owner
  gm
}
```

- [ ] **Step 5: Create .env.example at project root**

```
DATABASE_URL="postgresql://constancia:constancia@localhost:5432/constancia?schema=public"
```

- [ ] **Step 6: Install Prisma dependencies**

Run:
```bash
cd packages/db && npm install @prisma/client && npm install -D prisma && cd ../..
```

- [ ] **Step 7: Generate Prisma client (validates schema)**

Run:
```bash
cd packages/db && npx prisma generate && cd ../..
```

Expected: Prisma client generated successfully. This validates the schema is syntactically correct without needing a running database.

- [ ] **Step 8: Build**

Run: `npm run build --workspace=packages/db`
Expected: Build succeeds, `dist/index.js` and `dist/index.d.ts` created.

- [ ] **Step 9: Commit**

```bash
git add packages/db/ .env.example
git commit -m "feat: add db package with full Prisma schema — campaigns, characters, NPCs, events, journal, auth"
```

---

### Task 7: App Shells — Backend, Bot, Frontend

**Files:**
- Create: `apps/backend/package.json`
- Create: `apps/backend/tsconfig.json`
- Create: `apps/bot/package.json`
- Create: `apps/bot/tsconfig.json`
- Create: `apps/frontend/package.json`
- Create: `apps/frontend/tsconfig.json`

- [ ] **Step 1: Create apps/backend/package.json**

```json
{
  "name": "@constancia/backend",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "echo 'Backend not yet implemented'",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "test": "vitest run",
    "test:watch": "vitest watch"
  },
  "dependencies": {
    "@constancia/contracts": "*",
    "@constancia/core": "*",
    "@constancia/db": "*"
  }
}
```

- [ ] **Step 2: Create apps/backend/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [
    { "path": "../../packages/contracts" },
    { "path": "../../packages/core" },
    { "path": "../../packages/db" }
  ]
}
```

- [ ] **Step 3: Create apps/bot/package.json**

```json
{
  "name": "@constancia/bot",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "echo 'Bot not yet implemented'",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "test": "vitest run",
    "test:watch": "vitest watch"
  },
  "dependencies": {
    "@constancia/contracts": "*"
  }
}
```

- [ ] **Step 4: Create apps/bot/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [
    { "path": "../../packages/contracts" }
  ]
}
```

- [ ] **Step 5: Create apps/frontend/package.json**

```json
{
  "name": "@constancia/frontend",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "echo 'Frontend not yet implemented'",
    "build": "echo 'Frontend not yet implemented'",
    "typecheck": "echo 'Frontend not yet implemented'",
    "lint": "echo 'Frontend not yet implemented'"
  },
  "dependencies": {
    "@constancia/contracts": "*"
  }
}
```

- [ ] **Step 6: Create apps/frontend/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [
    { "path": "../../packages/contracts" }
  ]
}
```

- [ ] **Step 7: Run npm install to link workspaces**

Run: `npm install`
Expected: Workspaces linked, no errors.

- [ ] **Step 8: Verify turbo pipeline**

Run: `npx turbo run build`
Expected: contracts builds first, then core and db (depends on contracts), then apps (depend on packages). All succeed.

- [ ] **Step 9: Commit**

```bash
git add apps/ package-lock.json
git commit -m "feat: add app shells — backend, bot, frontend with workspace dependencies"
```

---

### Task 8: Full Pipeline Integration Test

**Files:**
- Create: `packages/core/src/__tests__/integration/pipeline-integration.test.ts`

- [ ] **Step 1: Write integration test**

Create `packages/core/src/__tests__/integration/pipeline-integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BlockRegistry } from '../../block-registry.js';
import { PipelineRunner } from '../../pipeline-runner.js';
import { outcomeMapBlock } from '../../blocks/outcome-map.js';
import { conditionalGateBlock } from '../../blocks/conditional-gate.js';
import { messagePlayerBlock } from '../../blocks/message-player.js';
import { messageChannelBlock } from '../../blocks/message-channel.js';
import { displayImageBlock } from '../../blocks/display-image.js';
import type { BlockContext, BlockInstance } from '@constancia/contracts';

function createRegistry(): BlockRegistry {
  const registry = new BlockRegistry();
  registry.register(outcomeMapBlock);
  registry.register(conditionalGateBlock);
  registry.register(messagePlayerBlock);
  registry.register(messageChannelBlock);
  registry.register(displayImageBlock);
  return registry;
}

describe('Pipeline Integration', () => {
  it('VTM-style test event: score → outcome → message player', async () => {
    const registry = createRegistry();
    const runner = new PipelineRunner(registry);

    const pipeline: BlockInstance[] = [
      {
        blockType: 'outcome-map',
        config: {
          outcomes: [
            { minScore: 0, maxScore: 0, text: 'You notice nothing unusual.' },
            { minScore: 1, maxScore: 2, text: 'Something moves in the shadows...' },
            { minScore: 3, maxScore: 10, text: 'You spot the Nosferatu hiding behind the pillar.' },
          ],
          shortCircuit: true,
        },
      },
      {
        blockType: 'message-player',
        config: { content: 'Test complete.' },
      },
    ];

    const ctx: BlockContext = {
      campaignId: 'c1',
      channelId: 'ch1',
      playerId: 'p1',
      playerScore: 3,
      characterData: {},
    };

    const result = await runner.run(pipeline, ctx);
    expect(result.halted).toBe(false);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].content).toBe(
      'You spot the Nosferatu hiding behind the pillar.',
    );
    expect(result.messages[1].content).toBe('Test complete.');
  });

  it('Stat insight event: gate passes → message player', async () => {
    const registry = createRegistry();
    const runner = new PipelineRunner(registry);

    const pipeline: BlockInstance[] = [
      {
        blockType: 'conditional-gate',
        config: { statPath: 'occult', operator: 'gte', threshold: 4 },
      },
      {
        blockType: 'message-player',
        config: { content: 'The sigil is Tremere — old clan markings.' },
      },
    ];

    const ctx: BlockContext = {
      campaignId: 'c1',
      channelId: 'ch1',
      playerId: 'p1',
      characterData: { occult: 4 },
    };

    const result = await runner.run(pipeline, ctx);
    expect(result.halted).toBe(false);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toContain('Tremere');
  });

  it('Stat insight event: gate fails → halts pipeline', async () => {
    const registry = createRegistry();
    const runner = new PipelineRunner(registry);

    const pipeline: BlockInstance[] = [
      {
        blockType: 'conditional-gate',
        config: { statPath: 'occult', operator: 'gte', threshold: 4 },
      },
      {
        blockType: 'message-player',
        config: { content: 'Should not see this.' },
      },
    ];

    const ctx: BlockContext = {
      campaignId: 'c1',
      channelId: 'ch1',
      playerId: 'p1',
      characterData: { occult: 2 },
    };

    const result = await runner.run(pipeline, ctx);
    expect(result.halted).toBe(true);
    expect(result.messages).toHaveLength(0);
  });

  it('Narration event: image + channel message', async () => {
    const registry = createRegistry();
    const runner = new PipelineRunner(registry);

    const pipeline: BlockInstance[] = [
      {
        blockType: 'display-image',
        config: { imageUrl: 'https://img.com/dark-alley.jpg', caption: '' },
      },
      {
        blockType: 'message-channel',
        config: { content: 'The alley reeks of blood and old stone.' },
      },
    ];

    const ctx: BlockContext = {
      campaignId: 'c1',
      channelId: 'ch1',
      playerId: 'p1',
      characterData: {},
    };

    const result = await runner.run(pipeline, ctx);
    expect(result.halted).toBe(false);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].imageUrl).toBe('https://img.com/dark-alley.jpg');
    expect(result.messages[1].content).toContain('alley reeks');
    expect(result.messages[1].target).toBe('channel');
  });
});
```

- [ ] **Step 2: Run integration tests**

Run: `npm run test --workspace=packages/core`
Expected: All tests pass — unit and integration.

- [ ] **Step 3: Run full turbo test pipeline**

Run: `npx turbo run test`
Expected: contracts tests pass, core tests pass.

- [ ] **Step 4: Run full turbo build pipeline**

Run: `npx turbo run build`
Expected: All packages and apps build successfully.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/__tests__/integration/
git commit -m "test: add pipeline integration tests — VTM test, stat insight, narration scenarios"
```

---

## Summary

After completing all 8 tasks, you have:

- A **buildable Turborepo monorepo** with 3 app shells and 3 packages
- **Full DX tooling**: ESLint 9, Prettier, Husky pre-commit/pre-push hooks, lint-staged
- **`@constancia/contracts`**: All shared TypeScript interfaces (GameSystem, Block, Character, NPC, Event, Journal, Auth)
- **`@constancia/core`**: BlockRegistry, PipelineRunner, 7 common block implementations with full test coverage
- **`@constancia/db`**: Complete Prisma schema for all entities (campaigns, characters, NPCs, events, journal, auth)
- **Integration tests** proving the block pipeline system works for VTM tests, stat insights, and narrations

**Next plan**: Plan 2 — Backend API (Fastify server, routes, Better Auth, OpenAPI generation, Orval config)
