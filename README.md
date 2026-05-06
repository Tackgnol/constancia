# Constancia

A GM-side toolkit for running tabletop RPGs that are played, in part or in
whole, on Discord. Constancia pairs a web "war room" for the Game Master with a
Discord bot that delivers narration, prompts, and rolls to the table — both
backed by a single Fastify API and a shared block-based event pipeline.

The first supported system is **Vampire: The Masquerade 5e**. **Mörk Borg** is
planned. New systems plug in through a system contract rather than schema
changes, so adding one does not require touching the core data model.

---

## What is in the repo

A pnpm-style workspace driven by Turborepo and npm workspaces, split into
deployable apps and shared packages.

```
apps/
  backend/    Fastify API. Source of truth. Owns auth, persistence,
              the event pipeline, and game logic.
  bot/        discord.js bot. Pure API client — translates Discord
              events to backend calls, renders backend responses.
  frontend/   React Router 7 GM dashboard ("war room"). SSR-rendered,
              talks to backend through an Orval-generated client.

packages/
  contracts/  Framework-agnostic TypeScript interfaces. Dependency root.
  core/       Block registry, pipeline runner, common platform blocks
              (MessagePlayer, ConditionalGate, ...).
  systems/    Game-system implementations. Each module implements the
              GameSystem contract. Currently: vtm (VTM v5 pool resolver).
  db/         Prisma schema and migrations. Only the backend imports it.
  api-client/ Orval-generated typed client used by bot and frontend.
```

A high-level rule that runs through the codebase: **the bot never holds game
logic**. Bot is presentation; the backend decides outcomes.

---

## Tech stack

- **Runtime:** Node.js 22, TypeScript strict, ES modules
- **Backend:** Fastify, Better Auth (magic link + optional Discord OAuth),
  Prisma + PostgreSQL, Zod-validated contracts
- **Bot:** discord.js v14, Fastify (internal HTTP for backend → bot delivery)
- **Frontend:** React Router 7 (SSR), Tailwind v4, Radix primitives,
  react-hook-form + Zod, orval-generated react-query client
- **Build:** Turborepo, npm workspaces
- **CI / Deploy:** Woodpecker, Docker Compose, Caddy on the host

---

## Getting started locally

Prerequisites: Node 22+, npm 11+, Docker (for Postgres).

```bash
git clone <this-repo>
cd constancia
npm ci

cp .env.example .env                           # dev defaults work as-is
docker compose up -d postgres                  # local database
npm --workspace @constancia/db run db:deploy   # apply migrations
npm run dev                                    # turbo: backend, bot, frontend
```

Useful per-app entry points once `npm run dev` is running:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001` (OpenAPI at `/openapi.json`)
- Bot HTTP: `http://localhost:3002` (internal, behind a shared API key)

The bot will not connect to Discord without `DISCORD_TOKEN` and `CLIENT_ID`
set. The rest of the stack runs without them.

### Repo-wide commands

```bash
npm run lint          # eslint across all workspaces
npm run typecheck     # tsc --noEmit across all workspaces
npm run test          # vitest across all workspaces
npm run build         # turbo build (used by the prod images)
npm run generate:api  # regenerate the orval client from the OpenAPI spec
```

---

## Production deploy

The repo deploys to a single Linux VM in Docker Swarm mode. Caddy on the host
terminates TLS and reverse-proxies to Swarm-published ports. CI is Woodpecker.

Files involved:

- `compose.prod.yaml` — services, networks, volumes
- `docker/{backend,bot,frontend}.prod.Dockerfile` — multi-stage builds, run as
  the unprivileged `node` user
- `.woodpecker/dev-tests.yaml` — typecheck + test on the `dev` branch
- `.woodpecker/branch-tests.yaml` — full PR gate (lint/typecheck/test/build +
  prod-image smoke build under an isolated Compose project)
- `.woodpecker/deploy.yaml` — `master` push: build, run migrations, deploy the
  Swarm stack, force-update runtime services, prune dangling images
- `env.production.example` — annotated reference for every env var, including
  which ones become Woodpecker secrets

### Network topology

The stack creates the app-private networks and also joins the pre-existing
`rpg-network` overlay used by the host reverse proxy.

```
db      (internal)  postgres  <->  backend, migrate
fe-be   (internal)  backend   <->  frontend
bot-be  (internal)  backend   <->  bot
rpg-network        Caddy     <->  backend, frontend
egress             backend, bot  ->  internet (Discord, OpenAI, R2)
```

Postgres has no internet route and no path from the frontend or the bot. The
frontend cannot reach the bot. The bot cannot reach the database. Caddy on the
host is the intended external entrypoint.

The production Caddy site should route Constancia like this:

```caddyfile
constancia.rpgtools.eu.org {
  import cloudflare_tls

  @backend path /api/auth/* /api/v1/auth/* /api/v1/uploads/*
  handle @backend {
    reverse_proxy 127.0.0.1:3021
  }

  handle {
    reverse_proxy 127.0.0.1:3020
  }
}
```

`/api/v1/uploads/*` is needed when testing R2 without a public R2 custom
domain. In that mode, uploaded objects are stored in R2 but served through the
backend URL.

### One-shot reproduction of the deploy locally

```bash
cp env.production.example .env
docker compose -f compose.prod.yaml up -d --build postgres
docker compose -f compose.prod.yaml run --rm migrate
docker compose -f compose.prod.yaml up -d --wait backend frontend
docker compose -f compose.prod.yaml up -d bot
```

---

## Configuration reference

`env.production.example` is the single source of truth for env vars and which
of them must come from secret stores in CI. The short version:

| Variable                 | Purpose                                                 |
| ------------------------ | ------------------------------------------------------- |
| `POSTGRES_PASSWORD`      | Database password. Set once; persisted in the volume.   |
| `BETTER_AUTH_SECRET`     | Session signing secret for Better Auth.                 |
| `BOT_API_KEY`            | Shared key for backend <-> bot HTTP.                    |
| `FRONTEND_URL`           | Public URL of the GM dashboard.                         |
| `BETTER_AUTH_URL`        | Public URL of the backend (auth lives at `/auth/*`).    |
| `BACKEND_PUBLIC_URL`     | Public URL of the backend (used to build upload URLs).  |
| `VITE_API_URL`           | Public URL of the backend (baked into the FE bundle).   |
| `DISCORD_TOKEN`          | Discord bot token.                                      |
| `DISCORD_CLIENT_ID`      | Discord application client ID.                          |
| `DISCORD_CLIENT_SECRET`  | Optional. Enables Better Auth Discord OAuth.            |
| `OPENAI_API_KEY`         | Optional. Required when `CONTENT_MODERATION_ENABLED`.   |
| `R2_*`                   | Optional. Required when `UPLOAD_STORAGE_DRIVER=r2`.     |
| `UPLOAD_PUBLIC_BASE_URL` | Optional. Direct public R2/custom-domain upload prefix. |
| `FRONTEND_PORT`          | Published frontend port for Caddy. Default `3020`.      |
| `BACKEND_PORT`           | Published backend port for Caddy. Default `3021`.       |

If you enable Discord OAuth, the redirect to register in the developer portal
is `${BETTER_AUTH_URL}/auth/callback/discord`.

---

## Project conventions

- TypeScript: `any` is forbidden; `unknown` must be narrowed at the boundary.
- Frontend forms must use `react-hook-form` (with `zodResolver` when the form
  has structured validation).
- The bot never holds game logic — only delivery and parsing.
- Per-system character data lives in JSON `systemData` blobs shaped by the
  system module, never in system-specific columns on the core schema.
- Identities are tied to Discord IDs (`discordGuildId`, `discordUserId`, ...).
  There are no separate user accounts.

See `AGENTS.md` for the longer-form house rules and `DESIGN.md` for the
frontend design system.

---

## Status

Foundations and full backend API are in place. Frontend has the GM dashboard
surfaces (campaigns, characters, NPCs, lore, journal, war room). Bot has the
delivery transport and is being expanded with discord.js commands. Mörk Borg
is on the roadmap.
