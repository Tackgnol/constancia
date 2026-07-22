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

- `packages/block-catalogue/src/index.ts`
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
- `apps/frontend/app/components/pipeline-block-editor-fields.tsx`

Also use it when the task mentions:

- `BlockDefinition`
- `BlockInstance`
- `EventPipeline`
- `BlockRegistry`
- `PipelineBlockSpec`
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
   - Shared metadata (label, config JSON Schema, default config, editor field layout):
     `packages/block-catalogue/src/index.ts`.

2. **NPC system block**
   - Passive system-specific NPC metadata.
   - Main contract: `packages/contracts/src/npc.ts`.

Do not conflate them in code or naming. When writing notes, comments, or PR text, prefer the explicit phrases **pipeline block** and **NPC system block**.

## Architecture Invariants

These rules are non-optional unless the task is explicitly architectural refactoring.

### Ownership

- `packages/contracts` defines shared contracts and must stay framework-agnostic.
- `packages/block-catalogue` is the shared, browser-safe metadata layer for pipeline blocks. It
  has zero runtime dependencies (only `@types/json-schema`) and must never depend on `packages/core`,
  `packages/systems`, `apps/backend`, or `apps/frontend` — everything else depends on it, not the
  other way around.
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
- The single source of truth for `blockType`, `label`, `configSchema`, `defaultConfig`, and the
  editor field layout is `PIPELINE_BLOCK_SPECS` in `packages/block-catalogue/src/index.ts`:
  - Runtime blocks in `packages/core/src/blocks/*` and `packages/systems/src/vtm-v5/*` import
    their `label`/`configSchema` from the matching spec via `requirePipelineBlockSpec(blockType)`
    instead of re-declaring them.
  - `apps/frontend/app/lib/event-schema.ts` derives `BLOCK_TYPES`, `BLOCK_LABELS`, and
    `defaultBlockConfigs` from `PIPELINE_BLOCK_SPECS`/`PIPELINE_BLOCK_TYPES` rather than declaring
    them as separate literals.
  - `apps/frontend/app/components/pipeline-block-editor-fields.tsx` renders each block's editor
    from `spec.editor.fields` (see `requirePipelineBlockSpec` there too), not from a hand-written
    per-block branch.
- Think of this as a one-to-one mirror: if you introduce or rename a VTM pipeline block, you add
  one entry to `PIPELINE_BLOCK_SPECS` and the runtime block that imports from it — you are not
  hand-authoring a second, independent frontend representation.

### What still needs a matching edit

Consolidating `label`/`configSchema`/`defaultConfig`/editor fields into `packages/block-catalogue`
removed most of the duplication, but two things still require you to touch more than one file:

- **Runtime behavior.** Adding or renaming a block still means writing the `BlockDefinition.execute`
  implementation in `packages/core/src/blocks/*` or `packages/systems/src/<system>/*`, registering
  it in `apps/backend/src/blocks.ts`, and adding the matching `PIPELINE_BLOCK_SPECS` entry. The
  catalogue describes the block; it does not run it.
- **Form validation shape.** `apps/frontend/app/lib/event-schema.ts` still hand-authors a parallel
  Zod schema per block type (`pipelineBlockConfigSchemas`) for `react-hook-form` UX validation
  (inline field errors, `.min(1)` messages, etc.). This is a second, independent encoding of each
  block's config shape from the catalogue's JSON Schema, kept deliberately because Zod gives
  better client-side error messages than translating JSON Schema/Ajv errors would. When you add or
  change a block's config shape, update both the catalogue's `configSchema`/`defaultConfig` **and**
  the corresponding Zod schema in `event-schema.ts`, and check that the catalogue's
  `defaultConfig` actually satisfies the Zod schema you just wrote (a default that a required-string
  Zod field rejects is a real, silent divergence — see the `outcome-map` `text` field history for a
  concrete example of this going wrong).

A block is not “done” if you only changed one of these layers.

## Current Source-of-Truth Map

### Shared block metadata

- `packages/block-catalogue/src/index.ts`
  - `PIPELINE_BLOCK_SPECS` — the array of `PipelineBlockSpec` (one per `blockType`): `label`,
    `availability`, `configSchema` (JSONSchema7), `defaultConfig`, `editor.fields`.
  - `requirePipelineBlockSpec(blockType)` / `getPipelineBlockSpec(blockType)` — lookup helpers used
    by runtime blocks and the frontend editor.
  - `listPipelineBlockSpecs(gameSystemId?)`, `isPipelineBlockAvailable(...)` — availability
    filtering for common vs. game-system-specific blocks.
  - `createDefaultPipelineBlock(blockType)` — clones a fresh `{ blockType, config }` pair for the
    editor's "add block" flow.
  - Zero runtime dependencies. Do not import `@constancia/core`, `@constancia/systems`, or
    anything backend/frontend-specific here.

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
  - common block implementations; each imports `label`/`configSchema` from
    `requirePipelineBlockSpec(blockType)` in `@constancia/block-catalogue` and supplies `execute`

- `packages/core/src/index.ts`
  - exported core blocks

### System runtime

- `packages/systems/src/index.ts`
  - exported system blocks and NPC system block definitions

- `packages/systems/src/vtm-v5/*`
  - VTM-specific resolvers and data; `pool-resolver.ts` and `insight-resolver.ts` source their
    `label`/`configSchema` from the catalogue the same way core blocks do

### Backend composition

- `apps/backend/src/blocks.ts`
  - `registeredBlocks` — the runtime blocks actually wired up (common + system blocks)
  - Boot-time check: every `PIPELINE_BLOCK_SPECS` entry has a matching runtime registration and
    vice versa (a coverage check, not a schema-equality check — see below)
  - `registeredBlockSchemas` — `PIPELINE_BLOCK_SPECS` mapped to `{ type, configSchema }` for
    request/OpenAPI composition
  - `buildBlockRegistry()`
  - Current smell to remember: this file still uses casts (`configSchema as Record<string, unknown>`,
    `register(block as never)`), so do not treat it as a fully enforced type boundary.

- `apps/backend/src/schemas.ts`
  - Fastify/OpenAPI schema composition for block instances

- `apps/backend/src/routes/event-routes.ts`
  - create/update/fire event pipeline flows

- `apps/backend/src/routes/bot-routes.ts`
  - bot-triggered pipeline execution paths

### Frontend editor

- `apps/frontend/app/lib/event-schema.ts`
  - `BLOCK_TYPES`, `BLOCK_LABELS`, `defaultBlockConfigs` — derived from
    `@constancia/block-catalogue`, not independently declared
  - `pipelineBlockConfigSchemas` — per-block Zod schemas for `react-hook-form` validation (see
    "What still needs a matching edit" above; this is the one part that is still hand-authored)
  - `pipelineBlockConfigNormalizers` — pre-submit config cleanup (e.g. recipient ID normalization)

- `apps/frontend/app/components/pipeline-builder.tsx`
  - add/remove/select UI for pipeline blocks; imports `BlockConfigFields` directly from
    `./pipeline-block-editor-fields.js`

- `apps/frontend/app/components/pipeline-block-editor-fields.tsx`
  - spec-driven editor field renderer: for each `field` in `spec.editor.fields`, looks up a
    `FieldAdapter` component by `field.kind` from `pipelineEditorFieldAdapters` (a
    `satisfies Record<EditorFieldKind, FieldAdapter>` map covering `text`, `textarea`, `number`,
    `boolean`, `json`, `select`, `system-stat-select`, `recipients`, `image`, `outcome-list`).
    Adding a new editor field kind means adding it to `PipelineEditorField` in
    `packages/block-catalogue/src/index.ts` and to this adapter map — the `satisfies` clause makes
    the compiler reject a missing adapter.
  - This is not a hand-rolled `if (blockType === ...)` chain and does not need a per-block branch;
    new blocks with existing field kinds require no changes here.

## Anti-Drift Rules

### 1. Do not re-declare a block's label or configSchema outside the catalogue

`label` and `configSchema` for a pipeline block live in exactly one place:
`PIPELINE_BLOCK_SPECS` in `packages/block-catalogue/src/index.ts`. Runtime blocks read them via
`requirePipelineBlockSpec`. If you find yourself typing a JSON Schema object or a label string
literal directly into a block module, stop — add or edit the catalogue entry instead.

### 2. Do not add a backend-only block silently

If a block is intended to be editable in the UI, backend registration alone is incomplete. Add the
`PIPELINE_BLOCK_SPECS` entry (which is what makes it appear in the editor) and register the
runtime block in `apps/backend/src/blocks.ts`; the boot-time coverage check fails fast if either is
missing.

### 3. Do not add a frontend-only block type

`PIPELINE_BLOCK_SPECS` entries without a real runtime block and backend registration create fake
capabilities — the boot-time check in `apps/backend/src/blocks.ts` throws in this case, but don't
rely on that as your first line of defense; check it yourself before running the backend.

### 4. Do not move game logic into the bot

The bot may render messages, perform API calls, and translate Discord interactions. It must not
implement pipeline behavior.

### 5. Do not move system-specific logic into `packages/core`

If a block depends on VTM or another game system's stat model or rules, it belongs in
`packages/systems`.

### 6. Do not forget persisted pipeline boundaries

Event pipelines are persisted and later re-read. Changes to config shape must consider reads from
the database, not just request-time validation.

### 7. Do not let the Zod form schema silently diverge from the catalogue's defaultConfig

`apps/frontend/app/lib/event-schema.ts`'s per-block Zod schemas are hand-authored independently of
`configSchema`. When you change a `configSchema`/`defaultConfig` in the catalogue, check that the
Zod schema still accepts that `defaultConfig` (a stricter Zod constraint, e.g. `.min(1)` on a field
the JSON Schema leaves unconstrained, will reject the catalogue's own default).

### 8. Do not treat “block” as one concept in prose

If the task touches NPC metadata and event pipelines, use explicit names for both concepts.

## Change Matrix

Use the smallest valid row set for the task.

### A. Adding a new common pipeline block

Check these areas in order:

1. Contract shape if needed in `packages/contracts/src/block.ts`
2. Spec entry (`blockType`, `label`, `availability`, `configSchema`, `defaultConfig`,
   `editor.fields`) in `packages/block-catalogue/src/index.ts`
3. Implementation in `packages/core/src/blocks/*`, sourcing `label`/`configSchema` from
   `requirePipelineBlockSpec(blockType)`
4. Export from `packages/core/src/index.ts`
5. Backend registration in `apps/backend/src/blocks.ts`
6. Backend schema composition in `apps/backend/src/schemas.ts` if needed
7. Frontend Zod validation schema in `apps/frontend/app/lib/event-schema.ts`
   (`pipelineBlockConfigSchemas`) — verify the catalogue's `defaultConfig` passes it
8. New editor field kinds (if any) in `packages/block-catalogue`'s `PipelineEditorField` and in
   `pipelineEditorFieldAdapters` in `apps/frontend/app/components/pipeline-block-editor-fields.tsx`
9. Pipeline builder behavior in `apps/frontend/app/components/pipeline-builder.tsx` if block
   availability changes
10. Tests covering runtime and any changed UI-facing schema logic

### B. Adding a new system-specific pipeline block

Check these areas in order:

1. Spec entry in `packages/block-catalogue/src/index.ts` with
   `availability: { kind: 'game-system', gameSystemIds: [...] }`
2. System implementation in `packages/systems/src/<system>/*`, sourcing `label`/`configSchema`
   from `requirePipelineBlockSpec(blockType)`
3. Export from `packages/systems/src/index.ts`
4. Backend registration in `apps/backend/src/blocks.ts`
5. Backend schema composition if needed
6. Frontend Zod validation schema if the block is editable
7. Tests in `packages/systems` and any backend integration coverage

### C. Changing a block config shape

Check these areas together:

1. `configSchema`/`defaultConfig` in `packages/block-catalogue/src/index.ts`
2. Runtime block implementation (the `execute` function's use of `config`)
3. Persisted pipeline read/write callers
4. Frontend Zod validation schema in `event-schema.ts` — re-verify it still accepts the catalogue's
   `defaultConfig`
5. Frontend config field rendering (`pipeline-block-editor-fields.tsx`) if the field shape or kind
   changed
6. Submission normalizers (`pipelineBlockConfigNormalizers`)
7. Existing tests that assume the old shape (including
   `packages/block-catalogue/src/__tests__/catalogue.test.ts`, which asserts every `defaultConfig`
   passes its own `configSchema` via Ajv)

### D. Changing pipeline execution behavior

Check these areas together:

1. `packages/contracts/src/block.ts`
2. `packages/core/src/pipeline-runner.ts`
3. `apps/backend/src/routes/event-routes.ts`
4. `apps/backend/src/routes/bot-routes.ts`
5. Any delivery/result contracts consumed by bot/frontend

### E. Reviewing drift in the current repo

Check these areas together:

1. `packages/block-catalogue/src/index.ts` as the shared metadata source of truth
2. `apps/backend/src/blocks.ts` for runtime-registration coverage against the catalogue
3. `apps/frontend/app/lib/event-schema.ts` for the still-hand-authored Zod validation layer
4. `packages/core/src/pipeline-runner.ts` as the runtime config-shape hotspot (no schema
   validation happens before `block.execute` is called)
5. `packages/block-catalogue/src/__tests__/catalogue.test.ts` — run it (`npm test -w
   @constancia/block-catalogue` or the repo-wide `npm run test`) to catch a `defaultConfig` that no
   longer satisfies its own `configSchema`

## Required Checklist Before Finishing Block Work

- [ ] Did I classify the task correctly as pipeline block vs NPC system block work?
- [ ] Did I keep execution logic in the backend?
- [ ] Did I keep system-specific logic out of `packages/core`?
- [ ] Did I add/change the block's `label`/`configSchema`/`defaultConfig`/`editor.fields` in
      `packages/block-catalogue/src/index.ts` rather than re-declaring them in a block module?
- [ ] If block types or config changed, did I inspect `apps/frontend/app/lib/event-schema.ts`
      (both the derived `BLOCK_TYPES`/`BLOCK_LABELS`/`defaultBlockConfigs` and the hand-authored
      `pipelineBlockConfigSchemas`)?
- [ ] If editable UI changed, did I inspect `pipeline-block-editor-fields.tsx` and
      `pipeline-builder.tsx`?
- [ ] If the block is editable, did I update the mirrored frontend representation for the same
      concept and `blockType`?
- [ ] If backend registration changed, did I inspect `apps/backend/src/blocks.ts`?
- [ ] If persisted pipeline shape changed, did I inspect DB read paths as well as write paths?
- [ ] Did I avoid adding new `any` or lazy `unknown` casts at the trust boundary?
- [ ] Did I verify the catalogue's `defaultConfig` still passes the corresponding Zod schema in
      `event-schema.ts` (run `packages/block-catalogue`'s tests and eyeball the Zod schema) if I
      changed either one?
- [ ] Did I run the relevant tests/checks for the touched code paths (`npm run lint`,
      `npm run typecheck`, `npm run test`)?

## History

`docs/review-2026-04-21.md` is the architecture review that identified the original three-way
duplication (`packages/core`/`packages/systems` block modules, the old frontend shadow catalogue in
`event-schema.ts`, and a hand-rolled `block-config-fields.tsx` `if`-chain) and proposed
`packages/block-catalogue` as the fix. That package now exists and is adopted as described above;
treat the review doc as a historical record of the problem, not a description of the current state.

## Default Implementation Bias

When multiple implementations are possible, prefer the one that:

1. preserves package boundaries from `AGENTS.md`
2. adds or edits exactly one `PIPELINE_BLOCK_SPECS` entry per block, rather than re-declaring
   label/config-shape metadata in `packages/core`, `packages/systems`, or the frontend
3. reduces backend/frontend drift
4. keeps runtime validation and execution closer to the backend boundary
