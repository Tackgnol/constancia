/**
 * Plain-script invariant check for `WarRoomProjection.eventCountByTag`.
 *
 * `apps/frontend` has no Vitest (or other test runner) configured yet — see
 * AGENTS.md / the frontend `package.json` — so this intentionally isn't a
 * Vitest test. It is a small, dependency-free assertion script (run with
 * `tsx`, already available at the workspace root) that both `npm run test`
 * (via the `test` script below) and a developer directly can run.
 *
 * Invariant under test (see the doc comment on `WarRoomProjection` in
 * `app/lib/war-room-projection.ts`): every key of `eventCountByTag` must also
 * appear in `tags.map((tag) => tag.id)`. Both the live and demo War Room
 * projections must derive `tags` and `eventCountByTag` from the same
 * id-space as `events[].channelId` — `tags` mirrors `channels`, and
 * `eventCountByTag` is built with `countEventsByChannel(events)`.
 */
import assert from 'node:assert/strict';
import { demoContext } from '../app/lib/demo-data.js';
import { loadDemoWarRoomProjection } from '../app/lib/demo-war-room-projection.js';
import { countEventsByChannel, type WarRoomProjection } from '../app/lib/war-room-projection.js';

function assertEventCountByTagIsSubsetOfTags(
  tags: WarRoomProjection['tags'],
  eventCountByTag: WarRoomProjection['eventCountByTag'],
  label: string,
): void {
  const tagIds = new Set(tags.map((tag) => tag.id));
  const strayKeys = Object.keys(eventCountByTag).filter((key) => !tagIds.has(key));
  assert.deepEqual(
    strayKeys,
    [],
    `${label}: eventCountByTag has keys not present in tags: ${strayKeys.join(', ')}`,
  );
}

// --- Demo adapter: exercise the real, fully-assembled projection. ---
const demoProjection = loadDemoWarRoomProjection();
assertEventCountByTagIsSubsetOfTags(demoProjection.tags, demoProjection.eventCountByTag, 'demo adapter');

// --- Live adapter: `loadLiveWarRoomProjection` fans out live backend calls,
// so it can't be exercised here without an HTTP-mocking layer this repo
// doesn't have yet. Instead, exercise the exact construction pattern it uses:
// `tags` is `channels.map((channel) => ({ id: channel.id, label: ... }))` and
// `eventCountByTag` is `countEventsByChannel(events)`. The demo fixture's
// already fully-typed `channels`/`events` (validated above to share an
// id-space) are reused here purely as realistically-shaped input data for
// this pattern check — no fabricated/cast objects. ---
const liveShapedTags = demoContext.channels.map((channel) => ({
  id: channel.id,
  label: `# ${channel.name}`,
}));
const liveShapedCounts = countEventsByChannel(demoContext.events);
assertEventCountByTagIsSubsetOfTags(liveShapedTags, liveShapedCounts, 'live adapter (construction pattern)');

console.log(
  'war-room-projection invariant check passed: eventCountByTag keys are a subset of tag ids (demo + live pattern).',
);
