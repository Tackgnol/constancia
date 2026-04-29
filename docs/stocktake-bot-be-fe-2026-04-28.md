# Bot ↔ Backend ↔ Frontend stocktake — 2026-04-29

Legend:
- `[x]` = working end-to-end across the current surfaces
- `[ ]` = incomplete overall (either partial, backend-only, frontend-only, or missing)

## Test Events
- [x] Create test event  
  FE setup form can create `test` events, BE persists them, and the pipeline editor supports test blocks.
- [ ] Update test event  
  BE has `PATCH /campaigns/:id/events/:eventId`, but there is no FE event editor and no bot-side editing flow.
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
- [ ] Update Insight event  
  BE patch route exists, but there is no FE editor or bot edit workflow.
- [x] Fire an Insight event  
  FE can fire it; BE resolves insight scores per character and sends resulting messages through the bot.
- [x] Send messages to players meeting criteria  
  Insight pipelines can combine resolver + conditional/message blocks to target qualifying players.
- [ ] Ability to add an NPC fact, Lore / journal entry automatically  
  No automatic write-back exists.

## Narration Events
- [x] Create Narration event  
  FE setup supports `narration` events.
- [ ] Update Narration event  
  BE patch exists, but no FE/bot editor exists.
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
- [ ] Reduce committed generated client churn
  Step 5 target: frontend and bot Orval clients are still committed as two large generated trees and produce noisy diffs.

## Short version
- Strongest working loop today: **event creation in FE → event firing in FE → backend execution → Discord delivery by bot**, plus **ad-hoc player whispers**.
- Best-developed content management area today: **NPC dossiers + facts + per-player fact reveal**, with moderation/upload plumbing now behind the backend.
- Present in backend but not truly surfaced yet: **quests**, **session-summary journal APIs**, and **admin upload controls**.
- Not implemented yet: **lore**, **NPC↔quest links**, **automatic event-driven writes into journal/NPC/lore systems**, and a cleaner generated-client strategy.

