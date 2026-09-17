import type { WarRoomContext } from './war-room-data.js';

export type WarRoomProjection = Pick<
  WarRoomContext,
  | 'campaign'
  | 'channels'
  | 'system'
  | 'tags'
  | 'players'
  | 'rawCharacters'
  | 'activity'
  | 'apiOnline'
  | 'events'
  | 'quests'
  | 'summaries'
  | 'lore'
  | 'npcs'
> & {
  /**
   * Invariant: every key of `eventCountByTag` must also appear in
   * `tags.map((tag) => tag.id)`. Both adapters (live and demo) must derive
   * `tags` and `eventCountByTag` from the same id-space as `events[].channelId`
   * (in practice: `tags` mirrors `channels`, and `eventCountByTag` is built with
   * `countEventsByChannel(events)`). Consumers key into this map with
   * `new Map(Object.entries(projection.eventCountByTag)).get(tag.id)`, so a
   * mismatched id-space silently produces zero counts everywhere.
   */
  eventCountByTag: Record<string, number>;
};

export function countEventsByChannel(events: WarRoomProjection['events']): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event.channelId] = (counts[event.channelId] ?? 0) + 1;
  }
  return counts;
}
