# FE → Backend → Bot Message Loop

## Goal
Keep one short source of truth for what is actually working today across the frontend, backend, and Discord bot.

This replaces the older "implementation plan only" note. The codebase has moved past that stage, so this doc is now a live functionality snapshot based on the current repo on 2026-04-23.

---

## Frontend

### What we have

- **Auth entry flow**
  - `/auth` supports browser-side magic-link verification.
  - Direct Discord OAuth sign-in is wired behind `VITE_DISCORD_AUTH_ENABLED`.
  - Authenticated sessions redirect into the GM dashboard.

- **Live war-room shell**
  - The authenticated layout loads service health, campaigns, systems, channels, events, and characters from the backend.
  - Main tabs are in place: `Setup`, `Play`, `NPCs`, `Participants`, `Log`.
  - Scene filtering is wired through layout context and shared by child routes.

- **Setup**
  - Event creation is live through `react-hook-form` + Zod-backed form state.
  - NPC dossier creation is present from the setup flow.
  - Validation and root/server error states are surfaced in the UI instead of failing silently.

- **Play**
  - Live mode can fire backend events through the `fireEvent` API.
  - Demo mode has a richer local control loop: trigger states, `next up`, keyboard help, keyboard navigation, arm/fire flow, and a short undo window for accidental fires.
  - Trigger cards now expose more context such as scene, target, and preview text.

- **NPC dossiers**
  - GM-facing NPC board exists with dossier browsing and detail views.
  - NPC facts can be managed and player knowledge can be assigned/revealed.
  - Player-safe dossier pages exist for sharing campaign NPC knowledge without exposing GM-only data.
  - Portrait fallback treatment is in place instead of initials-only placeholders.

- **Participants**
  - GM can review connected participants from the dashboard.
  - In-game name and archetype/clan can be edited and pushed back to backend character records.

- **Log**
  - Session-memory view exists.
  - Entries support scene-aware filtering and clearer timeline metadata.

- **Demo war room**
  - Fully local `/demo` shell exists for design and UX iteration without auth/backend dependency.
  - Demo quick narration, pulse feed, local fired-state tracking, setup flow, NPC dossiers, and filtered log are all working.

### Biggest current gaps

- The authenticated war-room shell is functional, but some of the most advanced interaction polish still lives only in demo mode.
- The live frontend still depends on generated clients and current backend contracts; any API drift needs regen + follow-through in the app.

---

## Backend

### What we have

- **Fastify application shell**
  - Fastify server bootstraps CORS, config, Better Auth, OpenAPI, root routes, health routes, and versioned API routes.
  - Prisma is the source of truth for persisted campaign data.

- **Auth**
  - Public auth endpoints support magic-link verification and logout.
  - Bot-protected auth endpoint can mint Discord-originated magic links for a user/guild pair.
  - Backend session model is now Discord-identity based rather than a separate bespoke user system.

- **Campaign operations**
  - Campaign routes are live and DB-backed.
  - Channel routes are live and DB-backed.
  - Character routes are live and DB-backed.
  - System listing is live, which is already consumed by both frontend and bot flows.

- **Events / pipeline execution**
  - Event CRUD is live and DB-backed.
  - `fireEvent` runs the pipeline through `PipelineRunner`.
  - When a fired event produces messages, the backend forwards them asynchronously to the bot HTTP service for Discord delivery.

- **NPCs**
  - Campaign NPC CRUD is live.
  - NPC facts are persisted and ordered.
  - Fact reveal / player knowledge assignment exists.
  - Player-visible NPC read models are implemented for player-safe surfaces.

- **Journal**
  - Quest CRUD exists.
  - Quest entry CRUD exists.
  - Session summary CRUD exists.
  - Player-scoped journal reads exist for Discord/player-facing consumption.

- **Bot support API**
  - Resolve campaign by guild.
  - Upsert campaign/channel from Discord `/setup`.
  - Sync and remove participants from Discord.
  - List ready events for a Discord channel.
  - Submit a player test result back into the event pipeline.
  - List NPCs visible to a given Discord player.

### Biggest current gaps

- Event status progression is still looser than the product model implies; firing an event does not yet fully act like a durable delivery state machine.
- Delivery is connected, but still lightweight compared to a true outbox/retry/audit trail.
- There are still contract-validation and type-safety follow-ups noted in the April 21 and April 20 reviews.

---

## Bot

### What we have

- **Discord client shell**
  - Discord.js client starts, logs in, registers commands, and routes interactions through a registry/router split.
  - Command registration is centralized instead of handled ad hoc in `main.ts`.

- **Slash commands**
  - `/login`
    - Requests a backend magic link for the invoking Discord user.
  - `/setup`
    - Links the current guild/channel to Constancia.
    - Supports game-system autocomplete from backend system registry.
    - Auto-registers the invoking GM as an initial participant when possible.
  - `/participants`
    - `add`
    - `remove`
    - `list`
  - `/roll`
    - Pulls ready channel events and submits a test result to the backend.
  - `/journal`
    - Reads player-visible quests and session summaries.
  - `/npc`
    - Looks up player-visible NPC dossiers and returns a field-dossier link into the frontend.

- **HTTP delivery service**
  - Bot hosts an internal Fastify HTTP server.
  - Backend can post message payloads into the bot for Discord delivery.
  - Delivery handles channel messages plus player/group-directed routing behavior from pipeline output.

- **Backend API client**
  - Bot consumes the backend through generated API client code rather than hand-rolling every request.

- **Tests**
  - Bot router tests exist.
  - Bot HTTP server tests exist.
  - Bot shell smoke coverage exists.

### Biggest current gaps

- There are no component handlers or modal handlers yet; the registry arrays are still empty.
- The bot is functional as a Discord command surface and delivery bridge, but it is not yet a broad gameplay UX layer.

---

## Summary

The repo is no longer at the "shell only" stage:

- **FE** has a usable war-room surface, auth flow, setup flow, dossier tooling, participants editing, log view, and a much richer demo board.
- **BE** has the real application core: auth, persistence, event execution, NPC knowledge, journal, system registry, and bot support endpoints.
- **Bot** has working slash commands, internal delivery HTTP service, and backend integration for setup, rolls, journals, participants, and NPC lookup.

The main story now is less "do these exist?" and more "which parts need hardening, cleanup, and parity between demo and live mode?"
