# Critique — FE → Backend → Bot Message Loop (uncommitted)

**Date**: 2026-04-20
**Branch**: `feat/plan-1-foundation`
**Basis**: `docs/superpowers/specs/2026-04-17-constancia-design.md`, `AGENTS.md`, plan `docs/superpowers/specs/2026-04-20-fe-be-bot-loop.md`
**Scope**: 24 changed files, ~870 net additions; new bot HTTP server, backend bot-client, command-router refactor.

---

## Verdict

The change closes the long-standing gap between `fireEvent` and Discord delivery and the refactor of `main.ts` into a registry/router pair is a clear win. However, the bot now ships its own HTTP surface with hand-rolled validation, environment access, and logging, none of which match the conventions the design spec and `AGENTS.md` set for the backend. The fire-and-forget delivery path also has reliability and correctness issues that matter once a GM is actually running a session.

**Ship-readiness**: Functional but not aligned. Address the P0/P1 items below before this lands on `main`.

---

## Alignment with the Spec

| Concern | Spec says | This change does | Verdict |
|---|---|---|---|
| Bot is a "pure API client", no game logic | yes | HTTP server only delivers messages from backend | OK |
| Backend ↔ Bot via REST on Docker network | yes | New POST `/send-messages`, x-bot-key auth | OK |
| Shared API key (service-to-service) | yes | `x-bot-key` header reused | OK, but see P0 below |
| Validation via Zod / Fastify schemas | yes (AGENTS.md "Validation & Schemas") | Hand-written `isBlockMessage` type guards | **Drift** |
| Backend uses `loadConfig` for env | yes | Bot reads `process.env.*` directly in `http-server.ts` | **Drift** |
| Discord IDs everywhere | yes | `discordChannelId` carried end-to-end | OK |
| `MessageGroup` DMs a set of players | yes | `targetId` is comma-joined string parsed at the edge | **Drift** (data-model smell) |
| Fired events: status `draft → ready → fired → archived` | yes | `fireEvent` route still does not transition status | **Pre-existing gap, now more visible** |

---

## Findings

### P0 — Block before merge

1. **Silent fallback to a public dev key** — `apps/bot/src/http-server.ts:14` and `apps/backend/src/services/bot-client.ts`
   - `getExpectedBotApiKey()` returns the literal `'constancia-bot-dev-key'` if `BOT_API_KEY` is unset. Backend's `sendMessagesToBotAsync` accepts `botApiKey: string | undefined` and simply omits the header if missing, so a misconfigured prod deploy silently authenticates with a value documented in `.env.example` and `AGENTS.md`.
   - Spec calls this a "trusted internal service" key. Misconfiguration must fail loudly, not default.
   - **Fix**: in production (`NODE_ENV === 'production'`) require `BOT_API_KEY`; throw at startup on the bot side, throw on first call on the backend side. Drop the default constant from runtime code (keep it only in `.env.example`).

2. **`!result.halted` swallows partial pipeline output** — `apps/backend/src/routes/event-routes.ts:217`
   - The forwarding branch is gated on `!result.halted`. Per the design spec, short-circuit mode "stops at the closest matching outcome rather than showing everything up to the score" — halting is a *normal* terminal state and any messages produced before the halt are exactly what the player should see.
   - **Fix**: forward whenever `result.messages.length > 0`, regardless of `halted`. If `halted` should suppress delivery (e.g., `ConditionalGate` failure), that decision belongs in the pipeline runner / individual blocks, not the route.

3. **Group delivery is fire-and-forget with no durability** — `event-routes.ts` + `bot-client.ts`
   - The backend response returns `200 OK` the moment `fetch` is queued. A bot crash, network blip, or the bot being mid-restart loses messages with zero trace. Spec says events live through `draft → ready → fired → archived`; there is no record that delivery happened or failed.
   - For live TTRPG play this is a real footgun — the GM hits Fire, the UI dims the card, and the players hear nothing.
   - **Fix (MVP-acceptable)**: at minimum, write the bot HTTP response status to a log line keyed by `eventId`. Better: persist a `delivery_attempt` row (eventId, status, attempts, lastError) so a follow-up retry/inspector is feasible. Outbox pattern is the proper end-state.

### P1 — Should fix in this PR

4. **Hand-rolled validation duplicates Zod's job** — `http-server.ts:37–73`
   - `isBlockMessage` and `isSendMessagesBody` reimplement what a Zod schema for `BlockMessage` (already a contract type) would express in 6 lines and reuse on the backend side. AGENTS.md is explicit: "Zod — runtime validation for forms, API payloads, and shared schemas".
   - **Fix**: define `botMessageSchema` once in `@constancia/contracts` (or `@constancia/core`), import on both sides. Use Fastify's schema validation hook so 400s and OpenAPI docs come for free.

5. **Bot reads env directly instead of a config module** — `http-server.ts:14–34`
   - Backend has `loadConfig()`. The bot reads `process.env.BOT_API_KEY`, `BOT_HTTP_PORT`, `BOT_HTTP_HOST` ad hoc, and `participants.ts` / `setup.ts` each carry their own `buildBotHeaders()` reading `process.env.BOT_API_KEY`.
   - **Fix**: introduce `apps/bot/src/config.ts` mirroring backend's shape; thread it explicitly into `buildBotHttpApp(client, config)` and into the API helpers. Removes three duplicate `buildBotHeaders` implementations (`participants.ts`, `setup.ts`, `bot-headers.ts`).

6. **`MessageGroup` target encoding is a CSV** — `http-server.ts:79–84`, contract for `BlockMessage`
   - `targetId: 'user-1,user-2'` parsed by `parseGroupTargetIds`. Discord snowflakes happen not to contain commas, so it works, but it makes the wire format brittle and inconsistent with the spec's "DM a set of players".
   - **Fix**: change the contract so `BlockMessage.target === 'group'` carries `targetIds: string[]`. Update emitters in `packages/core` (the `MessageGroup` block) and the Zod schema.

7. **Bot HTTP logger is hard-coded `true`** — `http-server.ts:181`
   - `Fastify({ logger: true })` writes pino JSON unconditionally. In tests this floods output; in dev it's noisy; in prod no one configured the destination. Backend uses `loadConfig().logLevel`-style control.
   - **Fix**: take `logger` from config, default `false` in tests (the test imports `buildBotHttpApp` directly, so this matters today).

8. **Bot service-to-service URL also has a silent localhost fallback** — `apps/backend/src/config.ts`
   - `DEFAULT_BOT_INTERNAL_URL = 'http://localhost:3002'`. In docker-compose you set `http://bot:3002`, but if anyone forgets the env, the backend will quietly try to reach a bot on its own loopback. Same failure mode as P0 #1, lower stakes.
   - **Fix**: require `BOT_INTERNAL_URL` in production; keep the localhost default scoped to dev only.

### P2 — Nits, low risk

9. **`async` on a fire-and-forget that doesn't `await`** — `bot-client.ts:14`
   - `sendMessagesToBotAsync` is declared `async` but only calls `fetch(...).catch(...)` without awaiting. The caller already does `void sendMessagesToBotAsync(...)`. Either `await fetch` (and let the caller decide whether to ignore the promise) or drop the `async` keyword. The current shape misleads readers about back-pressure.

10. **Redundant DM check** — `http-server.ts:101`
    - `('isDMBased' in channel && channel.isDMBased())` is defensive against a Discord.js shape that doesn't exist; `isSendable()` already narrows to a `SendableChannel`. Simplify to `channel.isDMBased()`.

11. **`registerCommands()` silently no-ops without `DISCORD_TOKEN`/`CLIENT_ID`** — `discord/register-commands.ts:6`
    - Easy footgun in CI / staging. At least `console.warn` so the failure mode is observable.

12. **`httpServerStarted` flag is intentional but undocumented** — `apps/bot/src/main.ts:22–28`
    - `Events.ClientReady` re-fires on gateway reconnect. The flag prevents re-`listen()`-ing, but `registerCommands()` is *not* guarded — that's probably intentional (refresh on reconnect) but worth a single-line comment, since the asymmetry will read as a bug to a future contributor.

13. **`imageUrl` shoehorned into the message body** — `http-server.ts:75`
    - Concatenating `content + '\n' + imageUrl` works because Discord auto-embeds bare URLs. Spec describes a `DisplayImage` block and NPCs with `imageUrl`, both of which deserve a real `EmbedBuilder` with `setImage()`. Fine for MVP, file a follow-up.

14. **Duplicate `BlockMessage`/`BotMessage` types** — `bot-client.ts:1–8`
    - Backend re-declares `BotMessage` instead of importing `BlockMessage` from `@constancia/contracts` (the bot side already does). This will drift. Import the contract type.

15. **Untracked review/plan doc has no acceptance criteria** — `docs/superpowers/specs/2026-04-20-fe-be-bot-loop.md`
    - Compared to the 491-line design spec, this 33-line plan has no error scenarios, no test list, and no rollout note. Acceptable as a working note but call it `plans/` not `specs/` so the directory's meaning stays consistent.

### What's working

- The `commands/* → command-registry → interaction-router` split is exactly the right shape; `main.ts` shrinks from 119 lines to 30 and gains symmetric handling for autocomplete / components / modals. Tests cover the routing branches.
- New tests in `__tests__/http-server.test.ts` exercise auth rejection, partial group failure counting, and player-DM failure isolation. Good coverage for code that's three days old.
- Setup gains a `game-system` autocomplete option backed by `GET /systems` — that's the first real consumer of the spec's "list registered game systems" endpoint, validating the modular-systems design.
- `apps/bot/src/api/participants.ts` now throws on missing response bodies instead of silently returning `{}`. Small but right — masks fewer bugs.

---

## Suggested next steps, in order

1. P0 #1 — kill the dev-key fallback in production paths.
2. P0 #2 — drop the `!halted` gate on message forwarding (or move the policy into the pipeline).
3. P1 #4 + #6 — share a Zod schema for `BlockMessage` between backend and bot, fix `targetIds: string[]`.
4. P1 #5 — introduce `apps/bot/src/config.ts`, eliminate the three duplicate `buildBotHeaders` helpers.
5. P0 #3 — at minimum, log delivery outcomes by `eventId` so a future retry/outbox is achievable.
6. P2 cleanups (#9–#15) batched into a follow-up.
