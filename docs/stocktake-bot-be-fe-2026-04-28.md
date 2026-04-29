# Bot ↔ Backend ↔ Frontend stocktake — 2026-04-29

Legend:
- `[x]` = working end-to-end across the current surfaces
- `[ ]` = incomplete overall (either partial, backend-only, frontend-only, or missing)

## Test Events
- [x] Create test event  
  FE setup form can create `test` events, BE persists them, and the pipeline editor supports test blocks.
- [x] Update test event
  FE setup can load an existing event into the pipeline editor and save it through `PATCH /campaigns/:id/events/:eventId`; backend moderation/upload cleanup still runs on update.
- [x] Fire a test event  
  FE play board fires the event, BE builds a test-instance payload, and bot posts the interactive test card into Discord.
- [x] Receive player input  
  Bot test cards open a modal and submit the player's numeric result back to BE.
- [x] Reply to player  
  Test-result handling can send follow-up player replies / DMs / channel messages from the resolved pipeline.
- [ ] Ability to add an NPC fact, Lore / journal entry automatically  
  No event block or persistence hook currently writes NPC facts, lore, quests, or journal summaries automatically.

## Insight Events
- [x] Create Insight event  
  FE setup form supports `insight` events and BE stores them.
- [x] Update Insight event
  FE setup can revise existing insight events through the shared event editor and backend patch route.
- [x] Fire an Insight event  
  FE can fire it; BE resolves insight scores per character and sends resulting messages through the bot.
- [x] Send messages to players meeting criteria  
  Insight pipelines can combine resolver + conditional/message blocks to target qualifying players.
- [ ] Ability to add an NPC fact, Lore / journal entry automatically  
  No automatic write-back exists.

## Narration Events
- [x] Create Narration event  
  FE setup supports `narration` events.
- [x] Update Narration event
  FE setup can revise existing narration events through the shared event editor and backend patch route.
- [x] Fire a Narration event  
  FE play board can fire narration events.
- [x] It sends the event to the channel  
  Narration/message-channel output is delivered by the bot to the Discord channel.
- [ ] Ability to add an NPC fact, Lore / journal entry automatically  
  No automatic write-back exists.

## Player messages
- [x] Select players on FE (even one is the minimum)
  The war room whisper panel can select a campaign player/character, and event pipeline blocks still support one or more configured recipients.
- [x] Send message to the selected players
  Dedicated FE whispers call `POST /campaigns/:id/messages/players`; backend moderation runs before delivery, and event-based direct messages remain available through pipelines.

## NPCs
- [x] Create NPCs  
  FE setup has an NPC dossier form; BE creates NPCs and optional starting facts.
- [x] Add facts  
  FE NPC screen can append facts; BE stores them.
- [x] Reveal facts to selected players  
  FE picker selects recipients and BE records knowledge. Bot `/npc` reflects revealed facts correctly. Note: the FE `Copy link` helper currently builds a player dossier URL with an extra `/for/:discordUserId` segment, so that share helper looks out of sync with the registered route.
- [ ] Link NPCs to Quests  
  No quest relationship exists in schema, routes, bot, or FE.
- [ ] Edit all that  
  Partial: FE can edit core NPC dossier fields and append facts, but existing facts are not editable, quest links do not exist, and there is no full CRUD surface.

## Quests
- [ ] Add tasks for players  
  Partial: BE has quest creation APIs, but no FE GM UI, no bot GM flow, and quests are campaign-level rather than assigned to selected players.
- [ ] Add steps to those task  
  Partial: BE supports quest entries/steps, but there is no FE or bot management surface.
- [ ] Reveal and hide tasks (all tasks hidden by default)  
  Partial: BE supports `visible` and defaults quests to hidden, but there is no FE or bot UI for toggling visibility.
- [ ] Mark tasks as completed with new information attached  
  Partial: BE can update quest status and add/update entries, but there is no end-to-end UI flow.
- [ ] Edit all that  
  Partial: backend CRUD exists for quests and entries, but FE/bot management is missing.

## Journal
- [ ] A place that summarizes Quests, NPCs, and Lore  
  Partial: BE journal covers quests + session summaries, and bot `/journal` shows quests + summaries to players. FE `log` is a static mock timeline, NPCs are separate, and lore does not exist yet.

## Lore
- [ ] Lore tidbits about the world  
  No lore model, routes, bot command, or FE UI currently exists.
- [ ] Like facts they can be known to certain players and not to others  
  No lore visibility system currently exists.

## Moderation and Uploads
- [x] Moderate text before persistence / delivery
  Backend text moderation is centralized across write surfaces and is configurable through environment settings.
- [x] Upload image assets through backend
  Backend multipart image uploads now run validation, image moderation/compression, quota checks, and storage through the storage abstraction.
- [x] Gate uploads per user
  User upload settings expose `uploadsEnabled`, allowance, used bytes, remaining bytes, and near-limit state.
- [x] Track upload allowance per user
  Default allowance is 50 MB and usage is calculated from stored asset metadata.
- [x] Link uploaded images to events for cleanup
  Event create/update links uploaded asset URLs from pipeline configs; event/channel deletion clears linked storage assets.
- [ ] Admin panel for upload allowance / upload enablement
  Backend settings and quota exist, but there is no admin management surface yet.

## Technical Cleanup / Safety
- [x] Validate persisted pipeline block configs before execution
  `PipelineRunner` validates each persisted block config against the registered JSON schema before executing it.
- [x] Preserve player-target pipeline messages
  Player-message blocks without an explicit `targetId` now default to the invoking player context, and system resolver output uses the shared block message contract.
- [x] Normalize backend response helpers and EventStatus schema
  Backend routes now share response/not-found helpers, and event status is explicit in OpenAPI/Orval instead of drifting through loose strings.
- [x] Reduce committed generated client churn
  Frontend and bot now consume one generated `@constancia/api-client` workspace package; generated source is ignored and rebuilt from OpenAPI instead of committed twice.
- [x] Remove empty bot wrapper modules
  Bot command/auth code now imports request options from `apps/bot/src/config.ts` directly, and the stale one-line delivery/API wrapper files are gone.

## Implementation Roadmap
These are the next implementation steps needed to close the remaining unchecked stocktake items. Step 6 is included for continuity with the current branch sequence.

- [x] **Step 6: Remove dead bot indirection**
  Delete empty bot wrapper modules and point imports at the owning modules. This keeps the bot API-client layer small before adding more bot-facing features.

- [x] **Step 7: Add an event editor for test, insight, and narration events**
  Build a FE edit flow around the existing BE `PATCH /campaigns/:id/events/:eventId` route. Reuse the current pipeline editor, preserve uploaded `imageUrl` values, surface moderation errors, and verify create/edit/fire still works for all three event types.
  Closes: update test event, update insight event, update narration event.

- [ ] **Step 8: Surface quest management in the GM UI**
  Add a dense quest/task management surface for creating quests, adding steps, editing status, toggling visibility, and attaching completion notes. Keep BE as source of truth, regenerate the shared API client if route contracts change, and keep bot `/journal` reading the same data.
  Closes: add tasks for players, add steps to those tasks, reveal/hide tasks, mark tasks completed, edit quests.

- [ ] **Step 9: Link NPCs to quests and complete NPC editing**
  Add the data relationship and API shape for NPC-to-quest links, then expose it in the NPC edit flow. Finish fact editing/deletion/visibility management and fix the FE player dossier copy-link route mismatch noted above.
  Closes: link NPCs to quests, edit all NPC dossier/fact data.

- [ ] **Step 10: Add lore as a first-class campaign domain**
  Introduce lore entries with per-player visibility, using the NPC fact reveal model as the closest existing pattern. Add BE routes, FE management/read views, and a bot read path or journal integration without moving game logic into the bot.
  Closes: lore tidbits, lore known to certain players and hidden from others.

- [ ] **Step 11: Replace the static FE log with a real player journal surface**
  Build a frontend journal/log view backed by BE data that summarizes quests, revealed NPC knowledge, lore, and session summaries. Align the bot `/journal` output with that same backend shape so players see consistent information across Discord and web.
  Closes: a place that summarizes quests, NPCs, and lore.

- [ ] **Step 12: Add event pipeline write-back blocks**
  Add backend-executed pipeline blocks for writing NPC facts, lore reveals, quest updates, and journal/session-summary entries from fired events. Treat every editable pipeline block as a mirrored backend/frontend contract: update core/system block definitions, backend registration/OpenAPI, frontend block schemas/default configs/edit fields, Orval output, and `check:block-drift` together.
  Closes: automatic event-driven NPC fact, lore, quest, and journal writes.

- [ ] **Step 13: Add admin upload controls**
  Build the admin panel controls for toggling user uploads and changing per-user storage allowance. Show used/remaining storage and near-limit/exceeded states from the existing backend settings/quota data.
  Closes: admin panel for upload allowance / upload enablement.

- [ ] **Step 14: Run end-to-end hardening across the loop**
  Add or update tests for event editing, quest visibility, NPC quest links, lore visibility, event write-back blocks, upload quota admin changes, OpenAPI/Orval generation, and block drift. Finish with full `lint`, `typecheck`, `test`, and `check:block-drift`.

## Short version
- Strongest working loop today: **event creation in FE → event firing in FE → backend execution → Discord delivery by bot**, plus **ad-hoc player whispers**.
- Best-developed content management area today: **NPC dossiers + facts + per-player fact reveal**, with moderation/upload plumbing now behind the backend.
- Present in backend but not truly surfaced yet: **quests**, **session-summary journal APIs**, and **admin upload controls**.
- Not implemented yet: **lore**, **NPC↔quest links**, and **automatic event-driven writes into journal/NPC/lore systems**.

