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

## Execution Order

Plan 1 (Foundation) is complete. The repo has moved beyond the plan into app scaffolding.

Current state:

- Done: `packages/contracts` — all shared TypeScript interfaces
- Done: `packages/core` — BlockRegistry, PipelineRunner, 7 common blocks, integration tests
- Done: `packages/db` — Prisma schema
- Done: `apps/backend` — Fastify server, Better Auth magic-link, all stub routes, full OpenAPI spec
- Done: `apps/bot` — shell with Orval-generated fetch client
- Done: `apps/frontend` — shell with Orval-generated react-query + zod client
- In progress: wiring routes to database (Prisma), real business logic

## Roadmap vs Current Repo

Present today:

- `packages/contracts`
- `packages/core`
- `packages/db` (Prisma schema, not yet migrated)
- `apps/backend` (stub routes, Better Auth wired, OpenAPI spec generated)
- `apps/bot` (Orval-generated API client, no Discord.js implementation yet)
- `apps/frontend` (Orval-generated API client, React Router 7 scaffolded)

Not yet implemented:

- Real DB-backed route handlers (currently all return stub data)
- Discord.js bot commands and event handlers
- Frontend UI components
- `packages/systems` (game system implementations, e.g. VTM)

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
