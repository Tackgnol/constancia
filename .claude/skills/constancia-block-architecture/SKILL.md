---
name: constancia-block-architecture
description: Use when changing Constancia block definitions, event pipelines, block registry wiring, frontend block editors, or system-specific block integration.
metadata:
  category: architecture
  triggers:
    - block architecture
    - BlockDefinition
    - BlockRegistry
    - event pipeline
    - block config
    - pipeline editor
    - registered blocks
    - outcome-map
    - vtm-pool-resolver
---

# Constancia Block Architecture

Repo-specific guardrails for Constancia's block system.

## Authority

- `AGENTS.md` is the repository-wide source of truth.
- This skill is the task-specific companion for block work.
- If this skill conflicts with `AGENTS.md`, follow `AGENTS.md`.

## Use When

Use this skill for any task touching:

- `packages/contracts/src/block.ts`
- `packages/core/src/block-registry.ts`
- `packages/core/src/pipeline-runner.ts`
- `packages/core/src/blocks/*`
- `packages/systems/src/*resolver*`
- `apps/backend/src/blocks.ts`
- `apps/backend/src/schemas.ts`
- `apps/backend/src/routes/event-routes.ts`
- `apps/backend/src/routes/bot-routes.ts`
- `apps/frontend/app/lib/event-schema.ts`
- `apps/frontend/app/components/pipeline-builder.tsx`
- `apps/frontend/app/components/block-config-fields.tsx`

Also use it when the task mentions:

- `BlockDefinition`
- `BlockInstance`
- `EventPipeline`
- `BlockRegistry`
- `registeredBlockSchemas`
- `buildBlockRegistry`
- `BLOCK_TYPES`
- `BLOCK_LABELS`
- `outcome-map`
- `message-player`
- `message-group`
- `vtm-pool-resolver`
- `vtm-insight-resolver`

## Core Mental Model

Constancia currently has **two different “block” concepts**:

1. **Pipeline block**
   - Runtime step in an event pipeline.
   - Defined by `BlockDefinition`, persisted as `BlockInstance`, executed by the backend.
   - Main contract: `packages/contracts/src/block.ts`.

2. **NPC system block**
   - Passive system-specific NPC metadata.
   - Main contract: `packages/contracts/src/npc.ts`.

Do not conflate them in code or naming. When writing notes, comments, or PR text, prefer the explicit phrases **pipeline block** and **NPC system block**.

## Architecture Invariants

These rules are non-optional unless the task is explicitly architectural refactoring.

### Ownership

- `packages/contracts` defines shared contracts and must stay framework-agnostic.
- `packages/core` owns common pipeline block implementations and runtime primitives.
- `packages/systems` owns system-specific logic and system-specific pipeline blocks.
- `apps/backend` is the execution and registration root for pipelines.
- `apps/frontend` edits pipeline structure and block configs; it does not execute game logic.
- `apps/bot` is a pure delivery/API client; it must not contain game logic.
- `packages/db` stays backend-only.

### Execution

- Pipelines run in the backend.
- The registry is assembled in the backend.
- Delivery payloads are shared via contracts, but block execution is not moved to the bot or frontend.

### Frontend/backend block reflection

- Treat every editable pipeline block as a **paired backend/frontend contract**.
- The backend owns the runtime `BlockDefinition` and execution semantics.
- The frontend owns the mirrored editing surface for that same block.
- For an editable block, the backend and frontend must reflect the same:
  - `blockType`
  - label/user-facing name
  - config shape
  - intended semantics
- In today's codebase, that reflection is split across:
  - backend runtime and registration in `packages/core`, `packages/systems`, and `apps/backend/src/blocks.ts`
  - frontend schema/defaults/picker metadata in `apps/frontend/app/lib/event-schema.ts`
  - frontend edit UI in `apps/frontend/app/components/block-config-fields.tsx`
- Think of this as a one-to-one mirror: if you introduce or rename a VTM pipeline block, you are also responsible for the corresponding VTM frontend block editor representation.
- Example mental model: **VTM stats block ↔ VTM stats component**. The names may differ slightly in implementation, but the reflected concept must stay one-to-one for editable blocks.

### Current catalogue reality

Block metadata is currently split across multiple places.

A block is not “done” if you only changed one layer.

## Exact Current Drift Hotspots

These four files are the current high-risk drift seam. When one changes, inspect the others deliberately.

### `apps/backend/src/blocks.ts`

- This is the current **execution catalogue truth** for registered pipeline blocks.
- `registeredBlocks` defines what the backend can actually run.
- `registeredBlockSchemas` is the backend-facing schema mirror used for request/OpenAPI composition.
- If a block is added here without a frontend mirror, the repo drifts immediately.
- Current smell to remember: this file still uses casts (`configSchema as Record<string, unknown>`, `register(block as never)`), so do not treat it as a fully enforced type boundary.

### `apps/frontend/app/lib/event-schema.ts`

- This is the current **frontend shadow catalogue**.
- Drift-prone structures here are:
  - `BLOCK_TYPES`
  - `BLOCK_LABELS`
  - `defaultBlockConfigs`
  - `pipelineBlockConfigNormalizers`
- For editable blocks, this file must mirror the backend catalogue for the same `blockType`.
- Current drift examples already present in the repo:
  - VTM labels in the frontend are shorter than backend runtime labels.
  - `defaultBlockConfigs` does not currently reflect every backend `configSchema` top-level key for every block.
- `pipelineBlockSchema.config` is still `z.record(z.string(), z.unknown())`, so block-specific config validation is not enforced here by discriminated union yet.

### `apps/frontend/app/components/block-config-fields.tsx`

- This is the current **per-block editor reflection surface**.
- The giant `if (blockType === ...)` chain is effectively a manual registry of editable blocks.
- Branch coverage here must stay in sync with `BLOCK_TYPES` and backend-registered editable blocks.
- If a backend block exists but there is no matching branch here, the editable block contract is incomplete.
- Current smell to remember: this file contains type escape hatches (`as never`, `as any`) around dynamic form paths, especially in `OperatorSelect` and `OutcomeMapConfig`.

### `packages/core/src/pipeline-runner.ts`

- This is the runtime execution hotspot where persisted pipeline drift becomes runtime behavior.
- Right now `PipelineRunner.run` calls `block.execute(instance.config, ctx)` directly.
- There is no obvious runtime validation step against `block.configSchema` before execution.
- Treat this file as the place where config-shape drift stops being editorial and becomes production behavior.
- If block config shapes evolve, inspect this file together with DB read paths and request validation.

## Current Source-of-Truth Map

### Shared contracts

- `packages/contracts/src/block.ts`
  - `BlockDefinition`
  - `BlockContext`
  - `BlockResult`
  - `BlockInstance`
  - `EventPipeline`
  - delivery payload/message types

- `packages/contracts/src/npc.ts`
  - `NpcSystemBlock`
  - `NpcSystemBlockValue`

### Common runtime

- `packages/core/src/block-registry.ts`
  - registration and lookup of runtime pipeline blocks

- `packages/core/src/pipeline-runner.ts`
  - runtime execution order and pipeline behavior

- `packages/core/src/blocks/*`
  - common block implementations

- `packages/core/src/index.ts`
  - exported core blocks

### System runtime

- `packages/systems/src/index.ts`
  - exported system blocks and NPC system block definitions

- `packages/systems/src/vtm-v5/*`
  - VTM-specific resolvers and data

### Backend composition

- `apps/backend/src/blocks.ts`
  - `registeredBlocks`
  - `registeredBlockSchemas`
  - `buildBlockRegistry()`

- `apps/backend/src/schemas.ts`
  - Fastify/OpenAPI schema composition for block instances

- `apps/backend/src/routes/event-routes.ts`
  - create/update/fire event pipeline flows

- `apps/backend/src/routes/bot-routes.ts`
  - bot-triggered pipeline execution paths

### Frontend editor shadow catalogue

- `apps/frontend/app/lib/event-schema.ts`
  - `BLOCK_TYPES`
  - `BLOCK_LABELS`
  - per-block config schemas
  - `defaultBlockConfigs`
  - pipeline normalizers

- `apps/frontend/app/components/pipeline-builder.tsx`
  - add/remove/select UI for pipeline blocks

- `apps/frontend/app/components/block-config-fields.tsx`
  - per-block config form rendering

## Anti-Drift Rules

### 1. Do not add a backend-only block silently

If a block is intended to be editable in the UI, backend registration alone is incomplete. You must also check the frontend editor shadow catalogue.

### 1a. Do not treat the frontend editor as optional for editable blocks

For editable pipeline blocks, the frontend mirror is part of the feature, not a later convenience. A backend block is incomplete until the matching frontend schema, defaults, picker metadata, and edit component exist for the same `blockType`.

### 2. Do not add a frontend-only block type

`BLOCK_TYPES` or `BLOCK_LABELS` changes without a real runtime block and backend registration create fake capabilities.

### 3. Do not move game logic into the bot

The bot may render messages, perform API calls, and translate Discord interactions. It must not implement pipeline behavior.

### 4. Do not move system-specific logic into `packages/core`

If a block depends on VTM or another game system's stat model or rules, it belongs in `packages/systems`.

### 5. Do not forget persisted pipeline boundaries

Event pipelines are persisted and later re-read. Changes to config shape must consider reads from the database, not just request-time validation.

### 6. Do not treat “block” as one concept in prose

If the task touches NPC metadata and event pipelines, use explicit names for both concepts.

## Change Matrix

Use the smallest valid row set for the task.

### A. Adding a new common pipeline block

Check these areas in order:

1. Contract shape if needed in `packages/contracts/src/block.ts`
2. Implementation in `packages/core/src/blocks/*`
3. Export from `packages/core/src/index.ts`
4. Backend registration in `apps/backend/src/blocks.ts`
5. Backend schema composition in `apps/backend/src/schemas.ts` if needed
6. Frontend editor metadata in `apps/frontend/app/lib/event-schema.ts`
7. Frontend editor fields in `apps/frontend/app/components/block-config-fields.tsx`
8. Pipeline builder behavior in `apps/frontend/app/components/pipeline-builder.tsx` if block availability changes
9. Tests covering runtime and any changed UI-facing schema logic

### B. Adding a new system-specific pipeline block

Check these areas in order:

1. System implementation in `packages/systems/src/<system>/*`
2. Export from `packages/systems/src/index.ts`
3. Backend registration in `apps/backend/src/blocks.ts`
4. Backend schema composition if needed
5. Frontend shadow catalogue updates if the block is editable
6. Frontend config fields if editable
7. Tests in `packages/systems` and any backend integration coverage

### C. Changing a block config shape

Check these areas together:

1. Runtime block implementation
2. Backend schema assembly and any request validation
3. Persisted pipeline read/write callers
4. Frontend config schema
5. Frontend default config
6. Frontend config field rendering
7. Submission normalizers
8. Existing tests that assume the old shape

### D. Changing pipeline execution behavior

Check these areas together:

1. `packages/contracts/src/block.ts`
2. `packages/core/src/pipeline-runner.ts`
3. `apps/backend/src/routes/event-routes.ts`
4. `apps/backend/src/routes/bot-routes.ts`
5. Any delivery/result contracts consumed by bot/frontend

### E. Reviewing drift in the current repo

Check these areas together:

1. `apps/backend/src/blocks.ts` as execution truth
2. `apps/frontend/app/lib/event-schema.ts` as frontend shadow catalogue
3. `apps/frontend/app/components/block-config-fields.tsx` as editor branch coverage
4. `packages/core/src/pipeline-runner.ts` as runtime config-shape hotspot
5. `npm run check:block-drift` for a fast scan of the current mirror state

## Required Checklist Before Finishing Block Work

- [ ] Did I classify the task correctly as pipeline block vs NPC system block work?
- [ ] Did I keep execution logic in the backend?
- [ ] Did I keep system-specific logic out of `packages/core`?
- [ ] If block types or config changed, did I inspect `apps/frontend/app/lib/event-schema.ts`?
- [ ] If editable UI changed, did I inspect `block-config-fields.tsx` and `pipeline-builder.tsx`?
- [ ] If the block is editable, did I update the mirrored frontend representation for the same concept and `blockType`?
- [ ] If backend registration changed, did I inspect `apps/backend/src/blocks.ts`?
- [ ] If persisted pipeline shape changed, did I inspect DB read paths as well as write paths?
- [ ] Did I avoid adding new `any` or lazy `unknown` casts at the trust boundary?
- [ ] Did I run the relevant tests/checks for the touched code paths?
- [ ] Did I run `npm run check:block-drift` when I touched block catalogue or editor reflection files?

## Current Structural Weak Point

As documented in `docs/review-2026-04-21.md`, the frontend currently maintains a manual shadow catalogue of blocks. Until the repo introduces a browser-safe shared metadata package, assume every block change may require synchronized edits in both backend and frontend.

## Target Direction

The intended direction is a shared browser-safe block metadata layer, described in `docs/review-2026-04-21.md` as a likely `packages/block-catalogue` style package.

Until that exists:

- treat backend runtime registration as the execution source of truth
- treat frontend block metadata as a required synchronized mirror
- prefer changes that reduce duplication instead of adding new parallel block lists

## Default Implementation Bias

When multiple implementations are possible, prefer the one that:

1. preserves package boundaries from `AGENTS.md`
2. reduces backend/frontend drift
3. avoids adding new parallel block catalogues
4. keeps runtime validation and execution closer to the backend boundary
5. leaves room for a future shared block metadata package


