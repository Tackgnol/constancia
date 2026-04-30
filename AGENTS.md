# AGENTS.md

## Scope

These instructions apply to the whole repository until a deeper `AGENTS.md` overrides them.

## First Step: Check Official Docs Before Coding

For any task involving framework or library behavior, start by checking the current official docs and recommended patterns before proposing or writing code.

Priority order for this repo:

- `discord.js` first for bot behavior, gateway/events, commands, intents, collectors, permissions, embeds, and interaction flows
- `React Router 7` first for frontend routing, loaders/actions, forms, data APIs, SSR, and route-module patterns
- `Fastify` first for backend plugins, route registration, schemas/validation, hooks, decorators, auth, and lifecycle concerns

Use official documentation to choose the implementation shape. Do not rely on memory when the docs can settle the question.

## Repo-Specific Skills

- Use `.claude/skills/constancia-block-architecture/SKILL.md` for any task touching `BlockDefinition`, `BlockRegistry`, event pipelines, block config changes, frontend pipeline editing, or system-specific block wiring.
- Use `.claude/skills/tell-me-why/SKILL.md` when `tell me why` is invoked or when a task needs a per-session rationale log; when routed there, create one new session log file automatically and record why each change was made, alternatives considered, and why the chosen file/layer is the right place for the change.
- `AGENTS.md` remains authoritative if the skill and this file ever disagree.

## Execution Order

Plan 1 (Foundation) is complete. The repo has moved beyond the plan into app scaffolding.

Current state:

- Done: `packages/contracts` — all shared TypeScript interfaces
- Done: `packages/core` — BlockRegistry, PipelineRunner, 7 common blocks, integration tests
- Done: `packages/db` — Prisma schema with migrations
- Done: `packages/systems` — VTM V5 pool resolver block with tests
- Done: `apps/backend` — Fastify server, Better Auth magic-link, all routes fully DB-backed (Prisma), OpenAPI spec
- Done: `apps/bot` — shell with Orval-generated fetch client
- Done: `apps/frontend` — shell with Orval-generated react-query + zod client

## Roadmap vs Current Repo

Present today:

- `packages/contracts`
- `packages/core`
- `packages/db` (schema + initial migration, not yet migrated against production DB)
- `packages/systems` (VTM V5 pool resolver; no Mörk Borg yet)
- `apps/backend` (all routes live: campaigns, channels, characters, NPCs, events, journal, bot, auth, systems)
- `apps/bot` (Orval-generated API client, no Discord.js commands yet)
- `apps/frontend` (Orval-generated API client, React Router 7 scaffolded, no UI components yet)

Not yet implemented:

- Discord.js bot commands and event handlers
- Frontend UI components
- Mörk Borg game system (`packages/systems/src/mork-borg/`)
- Orval client regeneration after channel routes were added

## Dependency Boundaries

Keep shared packages clean:

- `packages/contracts` should stay framework-agnostic and remain the dependency root
- `packages/core` may depend on `@constancia/contracts`, but should not pull in app-specific concerns
- Discord, Fastify, Prisma, and React Router code belongs in their future app/package boundaries, not in the current shared libraries, unless the task explicitly changes the architecture

## Execution Expectations

Before handing off substantial changes, mirror the repo's enforced checks locally:

- `npm run lint`
- `npm run typecheck`
- `npm run test`

When plan/spec documents and the live code disagree, use the live code for what exists today and the docs for intended direction.

## System Architecture & File Placement

When adding new files or functionalities, strictly adhere to the following boundaries:

- `apps/backend/`: Fastify API server. Source of truth. Contains all game logic, handles event pipeline execution.
- `apps/bot/`: Discord.js bot. **Pure API client.** The bot must never contain game logic. It only translates Discord events to backend API calls and renders responses.
- `apps/frontend/`: React Router 7 + ShadCN for GM management. **Browser code must never value-import `@constancia/api-client`; route all live reads/writes through route `loader`s/`action`s or server-only helpers.**
- `packages/contracts/`: Dependency root. Defines all interfaces (`GameSystem`, `Block`, etc). Nothing else depends on implementations.
- `packages/core/`: Common blocks and platform-level primitives (`MessagePlayer`, `ConditionalGate`).
- `packages/systems/`: Game system specific logic. Each module (e.g., `vtm`, `mork-borg`) implements the `GameSystem` contract and provides system-specific blocks.
- `packages/db/`: Prisma schema. Isolated, ONLY the backend imports it.

## Design Guidelines

### Data Modeling

- **systemData as JSON**: Character stats are stored as JSON shaped by the game system module. Do not add system-specific columns to the core schema.
- **System-specific NPC data stays flexible**: NPC archetypes, clan/creature-type style traits, and per-system stat payloads should live in generic JSON-backed structures (for example `systemData` / `systemBlocks`), not rigid per-system columns.
- **Discord IDs everywhere**: Tie entities directly to Discord IDs (e.g., `discordGuildId`, `discordChannelId`, `discordUserId`). No separate user accounts.

### TypeScript Discipline

- **`any` is strictly forbidden** in this repository.
- **`unknown` is a last resort** and must be narrowed immediately at the boundary where it appears.
- Prefer explicit shared interfaces, Prisma types, Zod-inferred types, or small typed helper objects over casts.

### Frontend Form Discipline

- **All frontend forms must use `react-hook-form`.** Do not hand-roll form state with local `useState` for submitted fields.
- Prefer **Zod schemas with `zodResolver`** for frontend form validation whenever the form has validation rules or structured payloads.
- For custom UI controls (for example Radix/ShadCN selects, checkboxes, or repeatable block editors), wire them through `react-hook-form` using `Controller`, `useFieldArray`, or form context helpers instead of maintaining parallel state.

### Frontend Backend Communication

- **Browser code must not call the backend directly.** Production networking only permits trusted hops: browser → frontend, frontend server → backend, bot → backend.
- **Do not introduce `VITE_*` backend API URLs.** Vite env values are build-time browser constants and will bypass the frontend server boundary.
- Put backend reads in React Router `loader`s and writes/sign-out/auth mutations in React Router `action`s, then forward cookies from the incoming request to `BACKEND_URL`.
- Only route modules, `loader`s, `action`s, and server-only helpers (for example `*.server.ts` helpers such as `app/lib/api-proxy.server.ts`) may value-import `@constancia/api-client`.
- Browser-only helpers, route components, and reusable UI components must not import or call `@constancia/api-client`; use same-origin route actions/loaders and browser-safe helpers instead (for example `app/lib/route-action-client.ts`).
- Treat `app/components/**` and non-server `app/lib/**` as browser-bound by default unless a file is clearly server-only.
- Before finishing frontend work, search `apps/frontend/app` for `@constancia/api-client` and confirm every remaining value import lives in a server-executed route module or server-only helper.

### Frontend Aesthetics ("War Room")

- **Vibe**: Dense, utilitarian, information-first.
- **Typography**: IBM Plex Mono for data/labels, IBM Plex Sans for content.
- **Palette**: GitHub-dark (`#0a0c0f` background, `#161b22` surfaces, `#1b2028` borders, `#58a6ff` primary accent).
- **Color Coding**:
  - Tests: Blue (`#58a6ff`)
  - Narrations: Purple (`#d2a8ff`)
  - Insights: Green (`#3fb950`)
  - Messages/DMs: Orange (`#f0883e`)
- **UX Requirements**: Fired events dim (35% opacity + dashed border) but remain visible. The "Play View" must be a dense control panel with single-click actions (no confirmation modals during live play).

## Known Issues (External)

- `npm install` warning: `prebuild-install@7.1.3: No longer maintained.`
  - **Source**: Upstream dependency of `better-sqlite3`.
  - **Status**: Tracked in `better-sqlite3` issue #1463. No stable version of `better-sqlite3` has removed this dependency yet. Ignore until `better-sqlite3` releases a fix.
