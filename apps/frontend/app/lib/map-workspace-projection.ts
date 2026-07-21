/**
 * Browser-safe shape of the Map workspace. Nothing here may import the generated API client:
 * the live adapter maps generated models into these types on the frontend server.
 */

export type ScenePegKind = 'event' | 'npc' | 'lore';

export type ScenePegProjection =
  | {
      id: string;
      kind: 'event';
      x: number;
      y: number;
      target: { id: string; name: string; status: string };
    }
  | {
      id: string;
      kind: 'npc';
      x: number;
      y: number;
      target: { id: string; name: string; imageUrl: string | null };
    }
  | { id: string; kind: 'lore'; x: number; y: number; target: { id: string; title: string } };

export interface SceneSummaryProjection {
  id: string;
  name: string;
  hasMap: boolean;
  pegCount: number;
}

export interface SceneDetailProjection {
  id: string;
  name: string;
  mapAssetId: string | null;
  mapUrl: string | null;
  pegs: ScenePegProjection[];
}

export interface MapCandidate {
  id: string;
  kind: ScenePegKind;
  label: string;
}

export interface MapWorkspaceCandidates {
  events: MapCandidate[];
  npcs: MapCandidate[];
  lore: MapCandidate[];
}

export interface MapWorkspaceProjection {
  campaignId: string | null;
  scenes: SceneSummaryProjection[];
  selectedScene: SceneDetailProjection | null;
  candidates: MapWorkspaceCandidates;
  apiOnline: boolean;
  errorMessage: string | null;
  demoMode: boolean;
}

export const noMapCandidates: MapWorkspaceCandidates = { events: [], npcs: [], lore: [] };

/**
 * A `?scene=` value is honoured only when the campaign actually returned that scene, so a stale
 * or hand-edited query string falls back to the first scene instead of showing a foreign one.
 */
export function selectSceneId(
  scenes: readonly SceneSummaryProjection[],
  requested: string | null,
): string | null {
  if (requested !== null && scenes.some((scene) => scene.id === requested)) {
    return requested;
  }

  return scenes[0]?.id ?? null;
}

/** The scene to select once the current one disappears, keeping the workspace on something real. */
export function nextSceneAfterRemoval(
  scenes: readonly SceneSummaryProjection[],
  removedId: string,
): string | null {
  const remaining = scenes.filter((scene) => scene.id !== removedId);
  const removedIndex = scenes.findIndex((scene) => scene.id === removedId);

  return remaining[Math.min(Math.max(removedIndex, 0), remaining.length - 1)]?.id ?? null;
}

export function unavailableMapWorkspace(
  demoMode: boolean,
  errorMessage: string,
): MapWorkspaceProjection {
  return {
    campaignId: null,
    scenes: [],
    selectedScene: null,
    candidates: noMapCandidates,
    apiOnline: false,
    errorMessage,
    demoMode,
  };
}

export function buildSceneMapPath(demoMode: boolean, sceneId: string | null): string {
  const base = demoMode ? '/demo/map' : '/map';
  return sceneId === null ? base : `${base}?scene=${encodeURIComponent(sceneId)}`;
}
