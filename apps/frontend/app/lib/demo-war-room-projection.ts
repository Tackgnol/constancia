import { demoContext } from './demo-data.js';
import { triggerSections } from './war-room-data.js';
import type { WarRoomProjection } from './war-room-projection.js';

function countDemoEventsByTag(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const section of triggerSections) {
    for (const item of section.items) {
      for (const tag of item.tags ?? []) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
  }
  return counts;
}

export function loadDemoWarRoomProjection(): WarRoomProjection {
  return {
    campaign: demoContext.campaign,
    channels: demoContext.channels,
    system: demoContext.system,
    tags: demoContext.tags,
    players: demoContext.players,
    rawCharacters: demoContext.rawCharacters,
    activity: demoContext.activity,
    apiOnline: demoContext.apiOnline,
    events: demoContext.events,
    quests: demoContext.quests,
    summaries: demoContext.summaries,
    lore: demoContext.lore,
    eventCountByTag: countDemoEventsByTag(),
  };
}
