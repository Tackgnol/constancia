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
> & {
  eventCountByTag: Record<string, number>;
};

export function countEventsByChannel(events: WarRoomProjection['events']): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event.channelId] = (counts[event.channelId] ?? 0) + 1;
  }
  return counts;
}
