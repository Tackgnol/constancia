# Constancia — TTRPG Session Management Platform

**Date**: 2026-04-17
**Status**: Approved design, pending implementation plan

## Overview

Constancia is a modular, system-agnostic TTRPG session management platform built around Discord as the primary player interface. It consists of three services:

1. **Backend API** — Fastify + Prisma, source of truth for all data
2. **Discord Bot** — Discord.js, player-facing interface for tests, narrations, insights, NPCs
3. **GM Frontend** — React Router 7 + ShadCN, session management dashboard for Game Masters

The platform is designed to support any tabletop RPG system through a modular architecture. Initial systems: Vampire: The Masquerade V5 and Mörk Borg.

## Architecture

### Service Topology

```
┌─────────────────┐     ┌─────────────────┐
│   GM Frontend   │     │   Discord Bot   │
│ React Router 7  │     │   Discord.js    │
│ ShadCN/Tailwind │     │                 │
│ Vercel/Oracle   │     │ Docker Container│
└────────┬────────┘     └────────┬────────┘
         │ REST + Session             │ REST + API Key
         │ (Better Auth)              │ (service-to-service)
         └──────────┬─────────────────┘
                    ▼
         ┌─────────────────┐
         │   Backend API   │
         │ Fastify + Prisma│
         │   DI Container  │
         │ Docker Container│
         └────────┬────────┘
                  ▼
         ┌─────────────────┐
         │   PostgreSQL    │
         │ Docker Container│
         └─────────────────┘
```

- Backend and bot run as separate Docker containers via Docker Compose on an Oracle Cloud ARM VM (Always Free tier: 4 OCPU, 24GB RAM)
- GM frontend deployed to Vercel or the same Oracle VM
- Bot and frontend are both API clients to the backend — neither touches the database directly
- Services communicate over HTTP/REST on the Docker network

### Monorepo Structure

```
constancia/
├── apps/
│   ├── backend/          # Fastify API server
│   ├── bot/              # Discord.js bot
│   └── frontend/         # React Router 7 + ShadCN
│
├── packages/
│   ├── core/             # Common blocks: MessagePlayer, MessageChannel,
│   │                     #   MessageGroup, RetrieveData, OutcomeMap, etc.
│   ├── contracts/        # GameSystem interface, Block interface,
│   │                     #   event types, shared TS types
│   ├── systems/
│   │   ├── vtm/          # VTM stats, pool resolution, hunger dice, character extension
│   │   └── mork-borg/    # Mörk Borg stats, d20 resolution, character extension
│   └── db/               # Prisma schema, migrations, generated client
│
├── docker-compose.yml
├── turbo.json            # Turborepo config
├── package.json          # Workspace root
└── tsconfig.base.json
```

- **Turborepo** for monorepo orchestration — lightweight, fast, TS-native
- `packages/contracts` is the dependency root — defines all interfaces, nothing else depends on implementations
- `packages/db` is isolated — only the backend imports it
- Game system modules live in `packages/systems/` and implement the `GameSystem` contract

## Module & Contract System

### GameSystem Interface

Every game system module implements this contract:

```typescript
interface GameSystem {
  // Identity
  id: string              // "vtm-v5", "mork-borg"
  name: string            // "Vampire: The Masquerade 5th Edition"
  version: string

  // Character extension
  statSchema: StatSchema   // defines what stats this system adds to characters

  // Resolution
  resolvers: Resolver[]    // stat resolution strategies

  // Test building
  testConfig: TestConfig   // what parameters GMs set when creating tests

  // Blocks this system provides
  blocks: BlockDefinition[] // system-specific blocks for event pipelines
}
```

### Block System

Blocks are composable primitives at two levels:

**Common blocks** (packages/core) — platform-level, delivery and data flow:
- `MessagePlayer` — DM a specific player
- `MessageChannel` — post to a channel
- `MessageGroup` — DM a set of players
- `RetrieveData` — fetch data (delegates to system modules for shape)
- `OutcomeMap` — score → narrative result mapping
- `ConditionalGate` — if stat ≥ threshold, proceed
- `DisplayImage` — attach an image to output

**System blocks** (packages/systems/*) — game-logic primitives:
- VTM: `VtmStats`, `VtmPoolResolver` (Attribute+Skill pool, hunger dice), `VtmHungerCheck`, `VtmRouse`
- Mörk Borg: `MbStats`, `MbD20Resolver` (d20 + ability vs DR), `MbOmens`

### Block Interface

```typescript
interface Block<TInput, TOutput> {
  id: string
  type: string              // "message-player", "vtm-pool-resolver"
  configSchema: JSONSchema   // validates GM-provided config at save time
  execute(input: TInput, ctx: BlockContext): Promise<TOutput>
}

interface BlockContext {
  campaignId: string
  channelId: string
  playerId: string
  playerScore?: number      // the reported roll result
  characterData: Record<string, unknown>  // full char incl. system modules
}
```

### Event Pipelines

An event is an ordered pipeline of blocks. The GM builds these in the frontend:

```
Test Event =
  [VtmPoolResolver(Wits + Awareness, diff 3)]
    → [OutcomeMap(0: fail, 1-2: partial, 3+: full)]
    → [MessagePlayer(result)]

Stat Insight Event =
  [ConditionalGate(Occult ≥ 4)]
    → [MessagePlayer("The sigil is Tremere...")]

Narration Event =
  [DisplayImage(dark_alley.jpg)]
    → [MessageChannel("The alley reeks of...")]
```

```typescript
interface EventPipeline {
  id: string
  name: string
  gameSystemId: string
  blocks: BlockInstance[]   // ordered, each with config
  shortCircuit: boolean    // stop at first matching outcome?
}
```

Events support short-circuiting: when enabled, the pipeline stops at the closest matching outcome rather than showing everything up to the score.

### VTM-Specific: Stat Resolution

VTM tests often combine two stats (Attribute + Skill) to form a dice pool. The `VtmPoolResolver` block handles this — it takes two stat references from the character's `systemData` and evaluates the player's reported score against a difficulty. This is more complex than Mörk Borg's single-stat d20 resolution, which validates the modular design handles both patterns.

## Data Model

### Core Entities

**Campaign**
- `id`, `name`
- `discordGuildId` — ties to a Discord server
- `gameSystemId` — "vtm-v5", "mork-borg"
- Has many: Channels, Characters, NPCs, CampaignAdmins, Events

**Channel**
- `id`, `name`
- `discordChannelId`
- `campaignId` — belongs to Campaign
- `type` — "main" | "scene" | "temp"
- Represents a "narrative container" — could be a full session, a scene, or a location

**Character**
- `id`, `name`, `backstory`, `notes`
- `discordUserId` — player identity
- `campaignId`
- `systemData` — JSON column, shaped and validated by the game system module
- Has many: NpcKnowledge

The character has a thin core that game system modules decorate. VTM stores `{"attributes": {"strength": 3, ...}, "skills": {...}, "disciplines": {...}}`, Mörk Borg stores `{"agility": -1, "presence": 2, "strength": 0, "toughness": 1}`.

**NPC**
- `id`, `name`, `imageUrl`, `description`
- `campaignId` — campaign-scoped
- Has many: NpcFact

**NpcFact**
- `id`, `content`, `sortOrder`
- `npcId` — belongs to NPC
- Individual pieces of knowledge about an NPC

**NpcKnowledge** (join table)
- `characterId` + `npcFactId`
- `revealedAt` — when the player learned this fact
- Per-fact, per-character visibility. The GM reveals individual facts to individual players.

**Event**
- `id`, `name`, `type`
- `channelId` — where it fires
- `campaignId`
- `pipeline` — JSON: ordered BlockInstance[]
- `status` — "draft" | "ready" | "fired" | "archived"
- `shortCircuit` — boolean

Events are reusable: status goes draft → ready → fired → archived. A fired event can be cloned.

**CampaignAdmin**
- `id`
- `discordUserId`
- `campaignId`
- `role` — "owner" | "gm"
- Links to Better Auth session

### Key Decisions

- **systemData as JSON**: Character stats stored as JSON, shaped by the game system module. No system-specific columns in the core schema.
- **Event pipeline as JSON**: Block pipeline stored as JSON array on Event. Schema stays stable regardless of block count.
- **NPC knowledge is granular**: Per-fact, per-character via join table. `revealedAt` enables "new fact" indicators.
- **Discord IDs everywhere**: Campaign→guildId, Channel→channelId, Character→userId. No separate player accounts.

## Authentication & Authorization

### Auth Flow

1. Bot joins a Discord server
2. Someone types `/admin` in a channel
3. Bot checks: does the user have a configured GM role, OR is this the first admin claim for the guild?
4. Bot calls backend: `POST /auth/magic-link { discordUserId, guildId }`
5. Backend (Better Auth) creates/finds user by discordUserId, generates magic link token
6. Bot DMs the user: "Here's your session link: https://frontend/auth?token=abc123"
7. GM clicks link → Better Auth validates token → session established
8. GM sees campaign dashboard, scoped to their guild(s)

### Two Auth Contexts

**GM Frontend → Backend**: Better Auth session cookies. Standard web auth. Frontend calls backend API with session cookie. Middleware validates and attaches user context (discordUserId + campaigns they admin).

**Bot → Backend**: Shared API key (service-to-service). Static API key in env vars. Trusted internal service on Docker network. Every request includes discordUserId/guildId context.

### GM Access Control

- **Role-based (default)**: Anyone with a configurable Discord role (e.g., "Storyteller") in the server automatically gets GM access.
- **Manual (override)**: The original admin can grant/revoke GM access to specific people regardless of role.

## API Surface

### Auth
```
POST /auth/magic-link         # bot requests magic link for a user
GET  /auth/verify?token=...   # frontend verifies magic link
POST /auth/logout             # clear session
```

### Campaigns
```
GET    /campaigns              # list GM's campaigns
POST   /campaigns              # create (on bot guild join)
GET    /campaigns/:id          # campaign details
PATCH  /campaigns/:id          # update settings, game system
```

### Characters
```
GET    /campaigns/:id/characters          # all chars in campaign
POST   /campaigns/:id/characters          # create character
GET    /campaigns/:id/characters/:charId  # with systemData
PATCH  /campaigns/:id/characters/:charId  # update core + systemData
```

### NPCs
```
GET    /campaigns/:id/npcs                # all NPCs
POST   /campaigns/:id/npcs                # create NPC
PATCH  /campaigns/:id/npcs/:npcId         # update NPC
POST   /campaigns/:id/npcs/:npcId/facts   # add fact
POST   /campaigns/:id/npcs/:npcId/reveal  # reveal fact to player(s)
GET    /campaigns/:id/npcs/for/:discordId # NPCs visible to a player
```

### Events
```
GET    /campaigns/:id/events              # list events (by status)
POST   /campaigns/:id/events              # create event + pipeline
PATCH  /campaigns/:id/events/:eventId     # edit event (even seconds before firing)
POST   /campaigns/:id/events/:eventId/fire # TRIGGER — runs pipeline via bot
```

### Bot-Facing
```
POST   /bot/test-result                   # player reported a score
GET    /bot/campaign-by-guild/:guildId     # resolve guild → campaign
GET    /bot/channel-events/:channelId     # active events for a channel
```

### Game Systems
```
GET    /systems                            # list registered game systems
GET    /systems/:id                        # system details, stat schema, blocks
```

## GM Frontend Design

### Aesthetic: War Room

Dense, utilitarian, information-first. The interface prioritizes density and immediate access over visual polish.

- **Typography**: IBM Plex Mono (data, labels) + IBM Plex Sans (content)
- **Palette**: GitHub-dark — #0a0c0f background, #161b22 surfaces, #1b2028 borders, #58a6ff primary accent
- **Color coding**: Tests (blue #58a6ff), Narrations (purple #d2a8ff), Insights (green #3fb950), Messages (orange #f0883e)
- **Fired events**: 35% opacity + dashed border + "FIRED" badge

### Two Views

**Setup View** (Backstage): Spacious, form-driven. Build events, compose block pipelines, manage NPCs, edit characters. This is prep mode — the GM has time to think.

**Play View** (Soundboard): Dense control panel. Three-column layout:
- **Left**: Event queue — ordered list of prepared events with ready/draft status
- **Center**: Soundboard grid — trigger buttons grouped by type (Tests, Narrations, Insights, DMs). Each button shows event name, key parameters, and fires on click.
- **Right**: Player panel — online status, character info, quick DM button, recent activity log

**Quick narration bar**: Fixed at the bottom, type-and-send for improvised narrations broadcast to the channel.

### Critical UX Requirements

- Events must be editable in seconds, even moments before firing — prep is a suggestion, not a script
- Fire button is a single click — no confirmation modals during live play
- Fired events visually dim but remain visible for reference
- Everything the GM needs during play is visible without scrolling or navigating

## Discord Bot Features

### Player-Facing Commands

**Global Tests**: GM fires a test event from the frontend. Bot posts to the channel with reaction buttons (score options) or accepts `!test{score}`. Player's reported score runs through the event pipeline, and the bot DMs them the result. Supports short-circuit mode.

**Narration Events**: Bot posts a pre-set message and optional image to the channel. System-agnostic — no rolls involved.

**Stat Insights**: Bot checks each player's character stats against a threshold. Players who meet the requirement automatically receive a DM with the insight message. No roll — passive knowledge check.

**NPCs**: Players DM the bot with `!vtm-npcs-all` (or system-equivalent) to see NPCs available to them. Each NPC shows name, image, description, and the facts known to that specific player.

### Bot Architecture

The bot is a pure API client. It:
- Authenticates with the backend via a shared API key
- Receives Discord events (messages, reactions, slash commands)
- Translates them into backend API calls
- Renders backend responses as Discord messages/embeds

The bot never contains game logic — it delegates everything to the backend, which runs the event pipeline through the appropriate game system module.

## Deployment

### Infrastructure

- **Oracle Cloud Always Free**: VM.Standard.A1.Flex, 4 OCPU, 24GB RAM, Oracle Linux 9
- **Docker Compose**: Backend + Bot + PostgreSQL as separate containers
- **Frontend**: Vercel (free tier) or same Oracle VM behind reverse proxy

### Communication

- Backend ↔ Bot: HTTP/REST on Docker internal network (near-zero latency on same host)
- Frontend → Backend: HTTPS over public internet
- Bot → Discord: Discord.js WebSocket gateway

## Tech Stack Summary

| Component | Technology |
|-----------|------------|
| Monorepo | Turborepo + npm/pnpm workspaces |
| Backend | Fastify, Prisma, Better Auth, TypeScript |
| Bot | Discord.js, TypeScript |
| Frontend | React Router 7 (framework mode), ShadCN, Tailwind, TypeScript |
| Database | PostgreSQL |
| DI | tsyringe (proven, decorator-based, lightweight) |
| Deployment | Docker Compose on Oracle Cloud ARM |
| Frontend hosting | Vercel or Oracle VM |

## Roll Behavior

Players always roll physical dice and report results to the bot. The bot is an information gateway based on the reported score, not a dice roller. A dice-rolling module could be added later as a plugin — the modular design supports it without core changes.

## Scope Boundaries

**In scope for MVP**:
- Core backend with Fastify + Prisma
- GameSystem contract and Block system
- VTM V5 game system module
- Mörk Borg game system module
- Discord bot with tests, narrations, stat insights, NPCs
- GM frontend with Setup and Play (soundboard) views
- Better Auth magic link flow via Discord
- Docker Compose deployment config

**Explicitly out of scope**:
- Dice rolling by the bot
- Runtime plugin loading (compile-time modules only for now)
- Player-facing web interface
- Mobile app
- Multi-language support
- Community game system marketplace
