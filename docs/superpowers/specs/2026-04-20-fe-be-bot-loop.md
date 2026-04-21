# FE → Backend → Bot Message Loop

## Goal
When the frontend fires an event (hold-to-fire button in play.tsx), the backend runs the pipeline and forwards resulting messages to the Discord bot, which delivers them to the appropriate Discord channel/players.

## Current State
- **Frontend**: `play.tsx` calls `fireEvent` API → works
- **Backend**: `fireEvent` runs pipeline, returns `{ eventId, messages, halted }` → works, but messages never reach Discord
- **Bot**: No HTTP server. Only Discord gateway. Has message-sending pattern in `roll.ts`

## Implementation Plan

### Step 1: Add HTTP server to bot (`apps/bot/src/main.ts`)
- Add Fastify on port `BOT_HTTP_PORT` (default 3002)
- `POST /send-messages` accepts `{ discordChannelId, messages: { target, content }[] }`
- Protected by `x-bot-key` header (same shared key pattern)
- Uses existing Discord.js client to send messages to channels

### Step 2: Create bot-client service in backend (`apps/backend/src/services/bot-client.ts`)
- Simple fetch-based POST to `BOT_INTERNAL_URL/send-messages`
- Sends `x-bot-key` header
- Fire-and-forget (don't block the HTTP response)

### Step 3: Add `botInternalUrl` to backend config
- `apps/backend/src/config.ts`: add `botInternalUrl?: string` (default `http://localhost:3002`)

### Step 4: Modify `fireEvent` route to forward messages
- After pipeline runs, if messages exist and not halted, POST to bot
- Need `discordChannelId` — resolve from channel record (already have channelId on event)

### Step 5: No frontend changes needed
- `play.tsx` already calls fireEvent and marks items as fired

