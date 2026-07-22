import { describe, expect, it } from 'vitest';
import {
  assembleScenePeg,
  buildSceneMapPath,
  buildTargetWorkspacePath,
  nextSceneAfterRemoval,
  noMapCandidates,
  selectSceneId,
  unavailableMapWorkspace,
  type SceneSummaryProjection,
} from '../map-workspace-projection.js';

const scenes: SceneSummaryProjection[] = [
  { id: 'scene-1', name: 'Rooftop Garden', hasMap: true, pegCount: 1 },
  { id: 'scene-2', name: 'Cellar', hasMap: false, pegCount: 0 },
  { id: 'scene-3', name: 'Undercroft', hasMap: false, pegCount: 0 },
];

describe('assembleScenePeg', () => {
  it('assembles an event peg with the event target shape', () => {
    const peg = assembleScenePeg(
      'peg-1',
      { x: 0.5, y: 0.5 },
      { kind: 'event', target: { id: 'event-1', name: 'Ambush', status: 'ready' } },
    );

    expect(peg).toEqual({
      id: 'peg-1',
      x: 0.5,
      y: 0.5,
      kind: 'event',
      target: { id: 'event-1', name: 'Ambush', status: 'ready' },
    });
  });

  it('assembles an npc peg with the npc target shape', () => {
    const peg = assembleScenePeg(
      'peg-2',
      { x: 0.2, y: 0.3 },
      { kind: 'npc', target: { id: 'npc-1', name: 'Marcel', imageUrl: null } },
    );

    expect(peg).toEqual({
      id: 'peg-2',
      x: 0.2,
      y: 0.3,
      kind: 'npc',
      target: { id: 'npc-1', name: 'Marcel', imageUrl: null },
    });
  });

  it('assembles a lore peg with the lore target shape', () => {
    const peg = assembleScenePeg(
      'peg-3',
      { x: 0.7, y: 0.8 },
      { kind: 'lore', target: { id: 'lore-1', title: 'The Camarilla' } },
    );

    expect(peg).toEqual({
      id: 'peg-3',
      x: 0.7,
      y: 0.8,
      kind: 'lore',
      target: { id: 'lore-1', title: 'The Camarilla' },
    });
  });
});

describe('selectSceneId', () => {
  it('honours a requested scene id that the campaign actually returned', () => {
    expect(selectSceneId(scenes, 'scene-2')).toBe('scene-2');
  });

  it('falls back to the first scene when the requested id is null', () => {
    expect(selectSceneId(scenes, null)).toBe('scene-1');
  });

  it('falls back to the first scene when a stale or hand-edited query string does not match any scene', () => {
    expect(selectSceneId(scenes, 'scene-from-another-campaign')).toBe('scene-1');
  });

  it('returns null when there are no scenes at all', () => {
    expect(selectSceneId([], 'scene-1')).toBeNull();
  });
});

describe('nextSceneAfterRemoval', () => {
  it('selects the following scene when the removed scene was in the middle', () => {
    expect(nextSceneAfterRemoval(scenes, 'scene-2')).toBe('scene-3');
  });

  it('selects the previous scene when the removed scene was last', () => {
    expect(nextSceneAfterRemoval(scenes, 'scene-3')).toBe('scene-2');
  });

  it('selects the only remaining scene when the removed scene was first', () => {
    expect(nextSceneAfterRemoval(scenes, 'scene-1')).toBe('scene-2');
  });

  it('returns null when removing the last remaining scene', () => {
    const solo: SceneSummaryProjection[] = [
      { id: 'scene-1', name: 'Rooftop Garden', hasMap: false, pegCount: 0 },
    ];
    expect(nextSceneAfterRemoval(solo, 'scene-1')).toBeNull();
  });

  it('returns null when the removed id was never in the list', () => {
    expect(nextSceneAfterRemoval([], 'scene-unknown')).toBeNull();
  });
});

describe('buildTargetWorkspacePath', () => {
  it.each([
    ['npc', 'npc-1', false, '/npcs?npc=npc-1'],
    ['npc', 'npc-1', true, '/demo/npcs?npc=npc-1'],
    ['lore', 'lore-1', false, '/lore?lore=lore-1'],
    ['lore', 'lore-1', true, '/demo/lore?lore=lore-1'],
  ] as const)(
    'builds the %s path for target %s (demo=%s) as %s',
    (kind, targetId, demoMode, expected) => {
      expect(buildTargetWorkspacePath(kind, targetId, demoMode)).toBe(expected);
    },
  );

  it('encodes a target id that needs escaping', () => {
    expect(buildTargetWorkspacePath('npc', 'npc one', false)).toBe('/npcs?npc=npc%20one');
  });
});

describe('buildSceneMapPath', () => {
  it.each([
    [false, null, '/map'],
    [true, null, '/demo/map'],
    [false, 'scene-1', '/map?scene=scene-1'],
    [true, 'scene-1', '/demo/map?scene=scene-1'],
  ] as const)(
    'builds the map path for demoMode=%s sceneId=%s as %s',
    (demoMode, sceneId, expected) => {
      expect(buildSceneMapPath(demoMode, sceneId)).toBe(expected);
    },
  );
});

describe('unavailableMapWorkspace', () => {
  it('produces an empty projection carrying the error message and demo flag', () => {
    expect(unavailableMapWorkspace(true, 'Campaign not found')).toEqual({
      campaignId: null,
      scenes: [],
      selectedScene: null,
      candidates: noMapCandidates,
      errorMessage: 'Campaign not found',
      demoMode: true,
    });
  });
});
