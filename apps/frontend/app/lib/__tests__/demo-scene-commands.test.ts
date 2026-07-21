import { describe, expect, it } from 'vitest';
import { buildDemoScenePeg } from '../demo-scene-commands.js';
import { toDemoSceneSummary } from '../demo-map-data.js';
import type { MapCandidate } from '../map-workspace-projection.js';

describe('buildDemoScenePeg', () => {
  const point = { x: 0.4, y: 0.6 };

  it('builds an event peg with a ready-status target', () => {
    const candidate: MapCandidate = { id: 'event-1', kind: 'event', label: 'Ambush' };
    const peg = buildDemoScenePeg(candidate, point);

    expect(peg.kind).toBe('event');
    expect(peg.x).toBe(0.4);
    expect(peg.y).toBe(0.6);
    if (peg.kind === 'event') {
      expect(peg.target).toEqual({ id: 'event-1', name: 'Ambush', status: 'ready' });
    }
  });

  it('builds an npc peg with no image url', () => {
    const candidate: MapCandidate = { id: 'npc-1', kind: 'npc', label: 'Marcel' };
    const peg = buildDemoScenePeg(candidate, point);

    expect(peg.kind).toBe('npc');
    if (peg.kind === 'npc') {
      expect(peg.target).toEqual({ id: 'npc-1', name: 'Marcel', imageUrl: null });
    }
  });

  it('builds a lore peg with a title drawn from the candidate label', () => {
    const candidate: MapCandidate = { id: 'lore-1', kind: 'lore', label: 'The Camarilla' };
    const peg = buildDemoScenePeg(candidate, point);

    expect(peg.kind).toBe('lore');
    if (peg.kind === 'lore') {
      expect(peg.target).toEqual({ id: 'lore-1', title: 'The Camarilla' });
    }
  });

  it('mints a unique demo peg id on every call', () => {
    const candidate: MapCandidate = { id: 'npc-1', kind: 'npc', label: 'Marcel' };
    const first = buildDemoScenePeg(candidate, point);
    const second = buildDemoScenePeg(candidate, point);

    expect(first.id).not.toBe(second.id);
    expect(first.id).toMatch(/^demo-peg-/);
  });
});

describe('toDemoSceneSummary', () => {
  it('reports hasMap true when a mapUrl is set', () => {
    const summary = toDemoSceneSummary({
      id: 'scene-1',
      name: 'Elysium',
      mapUrl: 'data:image/svg+xml,...',
      pegs: [],
    });

    expect(summary).toEqual({ id: 'scene-1', name: 'Elysium', hasMap: true, pegCount: 0 });
  });

  it('reports hasMap false when mapUrl is null', () => {
    const summary = toDemoSceneSummary({
      id: 'scene-2',
      name: 'The Docks',
      mapUrl: null,
      pegs: [],
    });

    expect(summary.hasMap).toBe(false);
  });

  it('derives pegCount from the number of pegs rather than a stored counter', () => {
    const summary = toDemoSceneSummary({
      id: 'scene-1',
      name: 'Elysium',
      mapUrl: null,
      pegs: [
        { id: 'p1', kind: 'lore', x: 0, y: 0, target: { id: 'lore-1', title: 'A' } },
        { id: 'p2', kind: 'lore', x: 0, y: 0, target: { id: 'lore-2', title: 'B' } },
      ],
    });

    expect(summary.pegCount).toBe(2);
  });
});
