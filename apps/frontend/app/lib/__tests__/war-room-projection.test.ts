import { describe, expect, it } from 'vitest';
import { countEventsByChannel, type WarRoomProjection } from '../war-room-projection.js';

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
