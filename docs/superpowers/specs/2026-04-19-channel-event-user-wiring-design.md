# Channel / Event / User Wiring — Design Spec
_Date: 2026-04-19_

## Problem

The bot, the frontend war room, and the database are structurally connected but not wired end-to-end:

- Bot commands land in Discord channels that have no `Channel` record in the DB, so `getChannelEvents` always returns empty.
- The frontend `setup.tsx` uses hardcoded `DEMO_CHANNELS` — submitted events reference fake channel IDs.
- The frontend `play.tsx` renders hardcoded `triggerSections` — no real events from the DB are shown or fired.

## Goals

1. **Bot `/setup` command** — a GM runs it in each Discord channel to register the campaign and channel in the DB.
2. **`setup.tsx` wired** — channel dropdown comes from the API; form submit creates a real `Event` record.
3. **`play.tsx` wired** — event board reads real events from the DB; hold-to-fire calls the pipeline API.
4. **`/demo` route untouched** — all hardcoded demo data, `triggerSections`, `sessionTags`, `players`, `activityFeed` remain in place.

---

## Architecture

```
Discord /setup (new)
  → POST /bot/setup-channel  (new endpoint)
      → upsert Campaign (discordGuildId)
      → upsert Channel  (discordChannelId)
      → ephemeral reply: "✓ Campaign: X | Channel: #Y registered"

war-room-layout clientLoader  (extended)
  → listCampaigns  → first campaign's id = campaignId
  → listChannels(campaignId)
  → listEvents(campaignId)
  → outletContext gains: campaignId, channels, events (as TriggerCard[])

setup.tsx  (wired when campaignId !== '')
  → channels from warRoom.channels (not DEMO_CHANNELS)
  → onSubmit → createEvent(campaignId, body) → revalidate

play.tsx   (wired when campaignId !== '')
  → events from warRoom.events (layout-fetched, not triggerSections import)
  → filter panel uses warRoom.channels as filter tags
  → hold-to-fire → fireEvent(campaignId, eventId) → useRevalidator()
```

The `'' === campaignId` check is the demo-mode sentinel. Both layouts call `setOutletContext` with the same `WarRoomContext` shape; `demo-layout.tsx` passes `campaignId: ''` and pre-mapped hardcoded events, the real layout passes the DB-backed versions.

---

## 1. Backend — `POST /bot/setup-channel`

### Schema additions (`schemas.ts`)

```ts
setupChannelBodySchema   // { guildId, guildName, discordChannelId, channelName, campaignName, gameSystemId }
setupChannelResponseSchema // { campaign: campaignSchema, channel: channelSchema, created: { campaign: bool, channel: bool } }
```

### Route logic (`bot-routes.ts`)

```
POST /bot/setup-channel
  body: { guildId, guildName, discordChannelId, channelName, campaignName, gameSystemId }

  1. prisma.campaign.upsert
       where:  { discordGuildId: guildId }
       create: { name: campaignName, discordGuildId: guildId, gameSystemId }
       update: {}   ← no-op; don't overwrite existing campaign data

  2. prisma.channel.upsert
       where:  { discordChannelId }
       create: { name: channelName, discordChannelId, campaignId: campaign.id, type: 'main' }
       update: {}   ← no-op

  3. return { campaign, channel, created: { campaign: wasCreated, channel: wasCreated } }
```

Prisma upsert returns the entity regardless of create-vs-update; track `wasCreated` by comparing `createdAt === updatedAt` or by a two-query pattern if needed.

After adding this route, **regenerate the Orval bot client**.

---

## 2. Bot — `/setup` slash command

### Registration (`main.ts`)

```ts
{
  name: 'setup',
  description: 'Register this channel with Constancia',
  options: [
    { name: 'name',   type: 3 /* STRING */, description: 'Campaign name',   required: true },
    { name: 'system', type: 3 /* STRING */, description: 'Game system ID',  required: true,
      choices: [
        { name: 'Vampire: The Masquerade V5', value: 'vtm-v5' },
        { name: 'Mörk Borg',                  value: 'mork-borg' },
      ]
    },
  ],
}
```

### Handler (`commands/setup.ts`)

```
handleSetup(interaction):
  1. deferReply({ ephemeral: true })
  2. Read guildId, guildName, channelId, channelName from interaction
  3. Call POST /bot/setup-channel with all six fields
  4. On success → editReply:
       "✓ Campaign: **{campaign.name}** | Channel: **#{channel.name}** registered"
       If created.campaign → add "(campaign created)"
       If created.channel  → add "(channel created)" vs "(channel already registered)"
  5. On error → editReply generic failure message
```

---

## 3. Frontend — `WarRoomContext` extension

### New types (`war-room-data.ts`)

```ts
export type ChannelEntry = {
  id: string;
  name: string;
  discordChannelId: string;
};

export type WarRoomContext = {
  // NEW
  campaignId: string;        // '' = demo / no campaign
  channels: ChannelEntry[];
  events: TriggerCard[];     // pre-mapped; layout is responsible for populating
  // EXISTING (unchanged)
  campaign: CampaignSummary;
  system: SystemSummary;
  tags: Tag[];
  activeTag: string | null;
  players: PlayerPresence[];
  activity: ActivityItem[];
  apiOnline: boolean;
};
```

`demo-data.ts` extends `demoContext` with:
```ts
campaignId: '',
channels: [],
events: triggerSections.flatMap(s => s.items),
```

---

## 4. Frontend — `war-room-layout.tsx`

### `clientLoader` (extended)

```ts
const campaigns = await listCampaigns(FETCH_OPTS);
if (campaigns.status !== 'ok') throw redirect('/auth');

const campaignId = campaigns.data[0]?.id ?? '';
const [channels, events] = campaignId
  ? await Promise.all([
      listChannels({ id: campaignId }, FETCH_OPTS),
      listEvents({ id: campaignId }, FETCH_OPTS),
    ])
  : [{ data: [] }, { data: [] }];

return { health, campaigns, systems, campaignId, channels, events };
```

### Context assembly

```ts
const outletContext: WarRoomContext = {
  campaignId,
  channels: channels.data ?? [],
  events: (events.data ?? []).map(e => toTriggerCard(e, channels.data ?? [])),
  tags: (channels.data ?? []).map(c => ({ id: c.id, label: c.name })),
  // ...rest unchanged (campaign, system, players, activity, apiOnline)
};
```

Helper `toTriggerCard(event, channels)`:
```ts
{
  id:   event.id,
  kind: event.type as TriggerKind,
  name: event.name,
  meta: channels.find(c => c.id === event.channelId)?.name ?? '',
  fired: event.status === 'fired',
  tags: [event.channelId],   // channelId used as filter key
}
```

The `tagEventCounts` computation in the layout uses the new `warRoom.events` array (keyed on `channelId`) rather than the hardcoded `triggerSections`.

---

## 5. Frontend — `play.tsx`

### Data source

Replace `triggerSections` import with `useOutletContext`:

```ts
const warRoom = useOutletContext<WarRoomContext>();
const events = warRoom.events;           // populated by layout
const isDemo  = warRoom.campaignId === '';
```

`initialFired` set derived from `events.filter(e => e.fired).map(e => e.id)`.

### Hold-to-fire

In the `setTimeout` callback, after updating `firedItems` locally:

```ts
if (!isDemo) {
  const revalidator = useRevalidator();
  try {
    await fireEvent({ id: warRoom.campaignId, eventId: currentItemId }, FETCH_OPTS);
    revalidator.revalidate();   // refreshes layout clientLoader → events update
  } catch {
    // roll back optimistic fired state, set errorItemId
    setFiredItems(prev => { const s = new Set(prev); s.delete(currentItemId); return s; });
    setErrorItemId(currentItemId);
    setLastAction('Fire failed — check connection.');
  }
}
```

`useRevalidator` must be called at the component top level (not inside the callback) — store its reference in a ref or pass it in.

### Filter panel

The filter panel in `war-room-layout.tsx` now uses `warRoom.channels` as tag buttons (already handled by the `tags` field being channels in the real war room context). No changes needed inside `play.tsx` for filtering.

---

## 6. Frontend — `setup.tsx`

### Channel dropdown

```ts
const warRoom = useOutletContext<WarRoomContext>();
const isDemo  = warRoom.campaignId === '';
const channelOptions = isDemo
  ? DEMO_CHANNELS          // keep existing const — demo route still uses it
  : warRoom.channels.map(c => ({ id: c.id, name: c.name }));
```

### Submit action

```ts
const onSubmit = async (values: EventFormValues) => {
  if (isDemo) {
    setSavedEvent(values);   // existing local-only behaviour
    return;
  }
  try {
    const result = await createEvent(
      { id: warRoom.campaignId },
      { name: values.name, type: values.type, channelId: values.channelId,
        shortCircuit: values.shortCircuit, pipeline: values.pipeline },
      FETCH_OPTS,
    );
    setSavedEvent(result.data);
  } catch {
    // surface error in form (use react-hook-form setError or local state)
  }
};
```

Success state shows `event.id` as confirmation instead of the raw JSON payload.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/backend/src/schemas.ts` | Add `setupChannelBodySchema`, `setupChannelResponseSchema` |
| `apps/backend/src/routes/bot-routes.ts` | Add `POST /bot/setup-channel` |
| `apps/backend/openapi/openapi.json` | Regenerated |
| `apps/bot/src/main.ts` | Register `/setup` slash command |
| `apps/bot/src/commands/setup.ts` | New — `handleSetup` handler |
| `apps/bot/src/api/generated/` | Regenerate Orval client |
| `apps/frontend/app/lib/war-room-data.ts` | Add `ChannelEntry`, extend `WarRoomContext` |
| `apps/frontend/app/lib/demo-data.ts` | Add `campaignId: ''`, `channels: []`, `events` |
| `apps/frontend/app/routes/war-room-layout.tsx` | Extended clientLoader + context assembly |
| `apps/frontend/app/routes/play.tsx` | Read events from context, fire via API |
| `apps/frontend/app/routes/setup.tsx` | Real channels + API submit when not demo |

**Not changed:** `demo-layout.tsx`. `war-room-data.ts` gets new types/fields added but all existing exports (`triggerSections`, `sessionTags`, `players`, `activityFeed`, etc.) are preserved. `demo-data.ts` existing fields are preserved; only `campaignId`, `channels`, `events` are added.

---

## Known Edge Cases

- **Empty campaign list** after auth: `campaignId` is `''`, channels/events load as empty arrays. The UI shows no events. A future "onboarding" flow will handle this.
- **`useRevalidator` in fire callback**: must be hoisted to component top level; pass via `ref` or captured in closure before the `setTimeout`.
- **Orval regeneration**: must run `npm run generate` (or equivalent) after adding the backend route and before building the bot.
- **Channel type on `/setup`**: always registers as `main`. A future `/setup-channel type:scene` option can be added.
