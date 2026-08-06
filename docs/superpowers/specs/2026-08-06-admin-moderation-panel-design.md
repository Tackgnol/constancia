# Admin Moderation Panel — Design

Date: 2026-08-06
Status: approved, ready for implementation planning

## Problem

Constancia writes in Discord on behalf of the GM. A player who receives something
objectionable is receiving it from the bot, not from another player. The operator
needs to be able to read what was reported and switch off the source — otherwise the
bot can be used in ways the operator does not want, and the only remedy is `psql`.

Report intake already works. Acting on a report does not.

## Current state

| Piece | State |
| --- | --- |
| Preventive moderation | Done. `services/content-moderation.ts` (`omni-moderation-latest`), `moderatePayloadText` wired into 11 route files and image uploads |
| Report intake | Done. Discord Report button → `POST /bot/message-reports` → `MessageReport` |
| Report triage | Half-built. `GET /admin/message-reports` is superuser-gated, `pending`-only, `take: 100`. Nothing writes `reviewed`/`dismissed`. `reviewedAt` and `reviewedByUserId` are dead columns. No UI |
| Ban | Nothing. No model, no enforcement |
| Overview dashboard | Nothing. Deferred (see Out of scope) |

Two facts that shape the design:

- **`MessageReport.discordUserId` is the reporter, not the offender.** `message-reports.ts:60`
  records `interaction.user.id` — whoever pressed Report. The reported content is scraped
  off a *bot* message and linked by `eventId`. The author of that content is the GM who
  wrote the event. The obvious ban target is the one person guaranteed innocent.
- **Moderation is already enforced at write time.** This panel is not for catching bad
  content. It is for acting on what got through, and on who sent it.

## Scope

In: report triage, campaign kill-switch, GM ban, enforcement, the panel to drive them.

Out:

- **Overview dashboard** (counts, charts, user browser, delivery-queue health). No forcing
  function behind it yet.
- **Decoupling `Campaign` from `discordGuildId`.** Its own spec. See Known consequences.

## Data model

```prisma
// Campaign kill-switch. Columns rather than a table: the MessageReport rows are the
// audit trail, so this only needs to record current state.
model Campaign {
  // ...existing fields...
  disabledAt           DateTime?
  disabledInternalNote String?
  disabledPublicReason String?   // spoken to ANYONE in the guild, players included
  disabledByUserId     String?
}

// No global Discord user table exists, so the ban is the table.
model DiscordUserBan {
  id                String   @id @default(cuid())
  discordUserId     String   @unique
  internalNote      String              // superuser eyes only
  reasonShownToUser String?             // spoken to the banned GM only; null -> fixed line
  bannedByUserId    String?
  createdAt         DateTime @default(now())

  bannedBy User? @relation(fields: [bannedByUserId], references: [id], onDelete: SetNull)

  @@map("discord_user_bans")
}
```

Net migration: four nullable columns on `campaigns`, one new table.

`disabledByUserId` is a plain column with no relation, unlike `DiscordUserBan.bannedByUserId`.
Deliberate: a relation would need a back-reference on `User` for a field only the panel reads,
and the panel already loads the superuser list. Promote it if a join ever becomes necessary.

### Two audiences, two fields

An operator note written while angry is not player-facing copy. Publishing incident notes
verbatim into a Discord channel turns a moderation action into a defamation problem and
leaks that someone reported. So each switch carries both:

- `internalNote` / `disabledInternalNote` — required, superuser eyes only, shown in the panel.
- `reasonShownToUser` / `disabledPublicReason` — optional, spoken by Constancia. Null falls
  back to a fixed neutral line.

The two public fields have **different audiences** and are deliberately named differently:

- `DiscordUserBan.reasonShownToUser` → spoken **only to that GM**, ephemerally, when they
  invoke Constancia. Players in their campaigns hear nothing and see no change unless the
  campaign is also disabled. A GM ban is between the operator and the GM.
- `Campaign.disabledPublicReason` → spoken to **anyone** who invokes Constancia in that
  guild, players included. Public by construction; this is the field to write carefully.

The panel labels each field with its audience rather than relying on the operator to
remember at 2am.

### Deliberately absent

- **No suspension history.** Un-disabling nulls the columns; unbanning deletes the row.
  Repeat-offence history lives in `MessageReport`, which is never deleted and carries
  `campaignId` and `eventId`. Promote to a table when "how many times has this GM been
  banned" becomes a real question.
- **No `MessageReport` migration.** `status`, `reviewedAt`, `reviewedByUserId` already exist
  and are dead. Triage starts writing them.
- **No `EventDelivery` migration.** `status` is a plain `String`, so `cancelled` is a new
  value, not a schema change.

## Enforcement

A ban means the bot goes quiet, including in-flight deliveries. Six points:

| # | Location | Behaviour |
| --- | --- | --- |
| 1 | `campaign-access.ts:169` `requireAdmin` | Campaign disabled → 403. Banned `discordUserId` → 403. Superuser bypasses both |
| 2 | `event-execution.ts` `fire()` | Refuse if campaign disabled |
| 3 | `event-execution-store.ts:112` claim query | `where execution.campaign.disabledAt = null` |
| 4 | Disable handler | One `updateMany` marking that campaign's `pending` deliveries `cancelled` |
| 5 | `bot-routes.ts:359` `setupChannel` | Find-then-branch instead of upsert; disabled campaign → 403, never revive |
| 6 | `bot-backend.ts` unwrap | 403 → surface `message` to the user ephemerally; anything else → generic line |

Notes:

- **#2 is not redundant with #1.** Bot routes authenticate by API key and never reach
  `requireAdmin`, so player-triggered events arrive at `fire()` directly. Worth a comment at
  the call site — it reads as redundant until you remember the bot has no session.
- **#3 and #4 are a pair.** #4 sweeps what is already queued, #3 catches anything that races
  in alongside the disable.
- **#5 is a hole, not a limitation.** Today `setupChannel` upserts on `discordGuildId` with
  `update: {}`, so after a campaign is disabled the next person to run setup in that guild is
  handed the disabled campaign back and their channel is attached to it — silently rejoining
  the campaign the operator killed.
- **#6 needs no new plumbing.** `ErrorResponse` is already `{ status: 'error', data: { message } }`,
  so the reason travels as the message. No error-code field, no ban lookup in the bot. The
  403-only condition matters: passing every backend error through to Discord would leak 500
  detail into a public channel. 403 is the "this text was written for a human" contract.

### Superuser bypass

Superusers bypass both guards at #1. This is the guardrail, not a gap — it is what makes
every switch reversible. Consequently there is no self-ban check and no
last-admin check: both prevent inconveniences that are undoable in one click.

## Panel surface

```
frontend
  /admin              admin-layout.tsx   loader: 403 unless isSuperUser
  /admin/reports      triage queue (default view)
  /admin/bans         active bans + disabled campaigns, lift from here

backend  (all inside superUserScopePlugin)
  GET    /admin/message-reports?status=pending   extend existing
  PATCH  /admin/message-reports/:id              { status: reviewed | dismissed }
  POST   /admin/bans                             { discordUserId, internalNote, reasonShownToUser? }
  DELETE /admin/bans/:discordUserId
  POST   /admin/campaigns/:id/disable            { internalNote, publicReason? }
  POST   /admin/campaigns/:id/enable
```

`superUserScopePlugin` mirrors the existing `campaignAdminScopePlugin`. Today
`admin-routes.ts:51` inlines `request.access.kind !== 'session' || !request.access.isSuperUser`;
six endpoints would copy that check, and the copy someone forgets is the whole problem.
Fastify encapsulation makes it structural.

### The join is the point

A flat `MessageReport` shows a complaint with no defendant. Each report must arrive already
resolved:

```
report -> event -> campaign -> { name, disabledAt, admins[].discordUserId }
```

so each row carries its own two actions — **ban this GM**, **disable this campaign** — both
already knowing their target.

`eventId` and `campaignId` are plain `String?` with indexes and **no foreign keys**; the only
relation on `MessageReport` is `reviewedBy`. `Event` cascades from `Campaign`, so deleting a
campaign leaves reports pointing at rows that no longer exist. The join is therefore a manual
lookup that must tolerate misses, and such rows render as "campaign deleted" with actions
disabled. Reports outliving their subject is correct behaviour, not a bug.

### Other surface decisions

- `?status=` filter with a `pending` default, replacing `pending`-only. Reviewing what was
  dismissed last month is the only way to notice a pattern.
- `/admin/bans` lists disabled campaigns alongside bans despite the different storage. They
  are one mental object — "things I have switched off" — and one page beats two.

## Error handling

**Precedence: ban is checked before campaign.** A banned GM in a disabled campaign trips both
guards. Checking the campaign first would hand them `disabledPublicReason`, which is
player-facing copy aimed at the wrong audience. The ban is the more specific fact and its
message is written for exactly that person.

**`cancelled` is terminal.** Re-enabling a campaign does not resurrect cancelled deliveries.
Those messages were composed for a game state that has moved on; firing week-old narration at
players is worse than losing it. Re-enable restores the ability to author and fire. It does
not replay.

**Re-banning is an upsert.** Banning an already-banned `discordUserId` updates the note rather
than 409ing on the unique constraint — you are re-banning because you have something to add.

## Testing

Unit tests (vitest, `apps/backend/src/__tests__` patterns), one file per guard:

```
campaign-access.test.ts   disabled campaign -> 403 with disabledPublicReason
                          banned GM         -> 403 with reasonShownToUser
                          both              -> ban message wins (precedence)
                          superuser         -> bypasses both
event-execution           fire() refuses disabled campaign
event-execution-store     claim query skips disabled campaigns
bot-routes                setupChannel 403s instead of reviving
admin-routes              PATCH sets status + reviewedAt + reviewedByUserId
                          non-superuser -> 403 on every /admin route
bot-backend               403 -> message surfaced; 500 -> generic line
```

Plus one BDD feature, `features/@moderation/ban.feature`: player reports → superuser bans the
GM → GM invokes Constancia → hears the reason → queued deliveries are `cancelled`. If exactly
one integration test exists here, it is that one; "the bot goes quiet" is the entire
requirement and it is the only assertion crossing all six enforcement points at once.

The precedence test looks like trivia. It is the one guarding against a player-facing string
reaching a GM-facing context, which cannot be taken back once it is in a Discord channel.

Not tested: frontend loader guard (one `throw redirect`, and the BDD feature walks it), and
the moderation service, which is already built and tested.

## Known consequences

**A disabled campaign occupies its Discord guild until decoupling lands.**
`Campaign.discordGuildId` is `@unique` and every guild lookup is
`findUnique({ where: { discordGuildId } })` across 8+ call sites. So after a campaign is
disabled, nobody in that server can start a fresh one.

This conflicts with the operator's stated policy — punish individuals, not servers — and is
knowingly accepted for now. The fix is not a partial unique index scoped to
`disabledAt IS NULL`: that workaround exists only to route around the `@unique`, which
disappears entirely once the guild binding is loosened. Building it now means paying for the
same decoupling twice and discarding the first attempt.

The wider gap the decoupling spec must address: one campaign per Discord server forever means
no two campaigns in one server, no campaign spanning two servers, and no campaign without
Discord at all. The binding is load-bearing in `auth-routes.ts:173`/`:238`, every bot command
that resolves guild → campaign, and `setupChannel`.

Until then: disabling a campaign leaves its players with no route to a replacement in that
server. Recorded as a consequence of the current model, not of the ban.
