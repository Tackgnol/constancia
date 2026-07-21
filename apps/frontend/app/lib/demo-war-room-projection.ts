import { demoContext } from './demo-data.js';
import { countEventsByChannel, type WarRoomProjection } from './war-room-projection.js';

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
    eventCountByTag: countEventsByChannel(demoContext.events),
  };
}
