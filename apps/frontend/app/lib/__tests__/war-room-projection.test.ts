import { describe, expect, it } from 'vitest';
import { demoContext } from '../demo-data.js';
import { loadDemoWarRoomProjection } from '../demo-war-room-projection.js';
import { countEventsByChannel, type WarRoomProjection } from '../war-room-projection.js';

function assertEventCountByTagIsSubsetOfTags(
  tags: WarRoomProjection['tags'],
  eventCountByTag: WarRoomProjection['eventCountByTag'],
): void {
  const tagIds = new Set(tags.map((tag) => tag.id));
  const strayKeys = Object.keys(eventCountByTag).filter((key) => !tagIds.has(key));
  expect(strayKeys).toEqual([]);
}

type WarRoomEvent = WarRoomProjection['events'][number];

function event(id: string, channelId: string): WarRoomEvent {
  return {
    id,
    name: 'Ambush',
    type: 'test',
    channelId,
    campaignId: 'campaign-1',
    status: 'ready',
    shortCircuit: false,
    pipeline: [],
  };
}

describe('countEventsByChannel', () => {
  it('returns an empty record for no events', () => {
    expect(countEventsByChannel([])).toEqual({});
  });

  it('counts one event per channel', () => {
    const events = [event('e1', 'ch-1'), event('e2', 'ch-2')];

    expect(countEventsByChannel(events)).toEqual({ 'ch-1': 1, 'ch-2': 1 });
  });

  it('sums multiple events in the same channel', () => {
    const events = [
      event('e1', 'ch-1'),
      event('e2', 'ch-1'),
      event('e3', 'ch-1'),
      event('e4', 'ch-2'),
    ];

    expect(countEventsByChannel(events)).toEqual({ 'ch-1': 3, 'ch-2': 1 });
  });
});

describe('eventCountByTag invariant', () => {
  // Every key of eventCountByTag must also appear in tags.map((tag) => tag.id) — see the
  // doc comment on WarRoomProjection. Both adapters must derive tags and eventCountByTag from
  // the same id-space as events[].channelId.
  it('holds for the real demo adapter', () => {
    const demoProjection = loadDemoWarRoomProjection();

    assertEventCountByTagIsSubsetOfTags(demoProjection.tags, demoProjection.eventCountByTag);
  });

  it('holds for the live adapter construction pattern', () => {
    // loadLiveWarRoomProjection fans out live backend calls and can't be exercised here without
    // an HTTP-mocking layer this repo doesn't have. Exercise the exact construction pattern it
    // uses instead: tags = channels.map((channel) => ({ id: channel.id, label: ... })), and
    // eventCountByTag = countEventsByChannel(events). The demo fixture's channels/events (already
    // validated above to share an id-space) are reused purely as realistically-shaped input.
    const liveShapedTags = demoContext.channels.map((channel) => ({
      id: channel.id,
      label: `# ${channel.name}`,
    }));
    const liveShapedCounts = countEventsByChannel(demoContext.events);

    assertEventCountByTagIsSubsetOfTags(liveShapedTags, liveShapedCounts);
  });
});
