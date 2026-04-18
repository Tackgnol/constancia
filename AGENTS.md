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

The repo is mid-setup against `docs/superpowers/plans/2026-04-17-plan-1-foundation.md`.

Current task state:

- Done: Task 1 `Initialize monorepo root`
- Done: Task 2 `ESLint, Prettier, Husky, lint-staged`
- Done: Task 3 `packages/contracts`
- In progress: Task 4 `packages/core — BlockRegistry and PipelineRunner`
- Open: Task 5 `packages/core — common block implementations`
- Open: Task 6 `packages/db — Prisma schema`
- Open: Task 7 `App shells — backend, bot, frontend`
- Open: Task 8 `Pipeline integration tests`

Advance work in that order unless the user explicitly reprioritizes. Do not jump ahead to app scaffolding, Prisma, or integration tests while the current task's slice is still incomplete.

## Roadmap vs Current Repo

The design and plan under `docs/superpowers/` describe the target architecture, but the repo has only been implemented through the shared-package phase so far.

Present today:

- `packages/contracts`
- `packages/core`

Not yet created in the live repo:

- `apps/backend`
- `apps/bot`
- `apps/frontend`
- `packages/db`
- `packages/systems`

Treat that gap as intentional roadmap state, not as something to "repair" automatically. Only create the missing areas when the active task reaches that step.

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
