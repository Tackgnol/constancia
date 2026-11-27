import { demo5eContext } from './demo-5e-data.js';
import { demoContext as vtmDemoContext } from './demo-data.js';
import { countEventsByChannel, type WarRoomProjection } from './war-room-projection.js';

export function loadDemoWarRoomProjection(fiveE = false): WarRoomProjection {
  const demoContext = fiveE ? demo5eContext : vtmDemoContext;
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
