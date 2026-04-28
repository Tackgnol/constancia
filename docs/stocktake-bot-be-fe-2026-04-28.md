# Bot ↔ Backend ↔ Frontend stocktake — 2026-04-28

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
- [ ] Select players on FE (even one is the minimum)  
  Partial: the event pipeline builder supports selecting one or more recipients for `message-player` / `message-group`, but the players rail `+ Whisper a player` control is only a placeholder.
- [ ] Send message to the selected players  
  Partial: this works through staged `message` events that are later fired, but there is no dedicated ad-hoc FE whisper/send flow.

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

## Short version
- Strongest working loop today: **event creation in FE → event firing in FE → backend execution → Discord delivery by bot**, especially for **test**, **insight**, **narration**, and **event-based direct messages**.
- Best-developed content management area today: **NPC dossiers + facts + per-player fact reveal**.
- Present in backend but not truly surfaced yet: **quests** and **session-summary journal APIs**.
- Not implemented yet: **lore**, **NPC↔quest links**, and **automatic event-driven writes into journal/NPC/lore systems**.

