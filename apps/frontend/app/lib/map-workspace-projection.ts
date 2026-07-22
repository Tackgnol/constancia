/**
 * Browser-safe shape of the Map workspace. Nothing here may import the generated API client:
 * the live adapter maps generated models into these types on the frontend server.
 */

import type { FireReceiptView } from './fire-event-receipt.js';
import type { NormalizedPoint } from './map-coordinates.js';

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
  errorMessage: string | null;
  demoMode: boolean;
}

/** One key per armed attempt, so a retried ambiguous fire collapses onto the same execution. */
export interface ArmedFireAttempt {
  pegId: string;
  eventId: string;
  idempotencyKey: string;
}

/**
 * The write-side counterpart to `MapWorkspaceProjection`: every mutation resolves to whether it was
 * accepted, so callers can roll back optimistic UI. Demo and live each implement this once, in their
 * own module, so `MapWorkspace` never has to know which one it was handed.
 */
export interface SceneCommands {
  create: (name: string) => Promise<boolean>;
  rename: (sceneId: string, name: string) => Promise<boolean>;
  remove: (sceneId: string) => Promise<boolean>;
  replaceMap: (sceneId: string, file: File) => Promise<boolean>;
  removeMap: (sceneId: string) => Promise<boolean>;
  createPeg: (sceneId: string, candidate: MapCandidate, point: NormalizedPoint) => Promise<boolean>;
  movePeg: (sceneId: string, pegId: string, point: NormalizedPoint) => Promise<boolean>;
  removePeg: (sceneId: string, pegId: string) => Promise<boolean>;
  fireEvent: (attempt: ArmedFireAttempt) => Promise<FireReceiptView | null>;
  pending: boolean;
  error: string | null;
  status: string | null;
  quotaWarning: string | null;
  clearError: () => void;
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
    errorMessage,
    demoMode,
  };
}

/**
 * Assembles a peg from its parts, re-discriminating on `kind` purely so the union stays exact.
 * Both the live projection (from an already-full API peg) and the demo commands (from a candidate
 * plus a drop point) funnel through here, so there is exactly one place that shapes a peg.
 */
export function assembleScenePeg(
  id: string,
  point: NormalizedPoint,
  discriminant:
    | { kind: 'event'; target: Extract<ScenePegProjection, { kind: 'event' }>['target'] }
    | { kind: 'npc'; target: Extract<ScenePegProjection, { kind: 'npc' }>['target'] }
    | { kind: 'lore'; target: Extract<ScenePegProjection, { kind: 'lore' }>['target'] },
): ScenePegProjection {
  switch (discriminant.kind) {
    case 'event':
      return { id, ...point, kind: 'event', target: discriminant.target };
    case 'npc':
      return { id, ...point, kind: 'npc', target: discriminant.target };
    case 'lore':
      return { id, ...point, kind: 'lore', target: discriminant.target };
  }
}

/** Lore targets carry `title` rather than `name`; every other peg kind carries `name`. */
export function pegTargetName(peg: ScenePegProjection): string {
  return peg.kind === 'lore' ? peg.target.title : peg.target.name;
}

/**
 * NPC and lore pegs link into the workspace that already owns reveal and access management, rather
 * than duplicating those forms inside Map.
 */
export function buildTargetWorkspacePath(
  kind: Exclude<ScenePegKind, 'event'>,
  targetId: string,
  demoMode: boolean,
): string {
  const base = demoMode ? '/demo' : '';
  const query = kind === 'npc' ? 'npc' : 'lore';

  return `${base}/${kind === 'npc' ? 'npcs' : 'lore'}?${query}=${encodeURIComponent(targetId)}`;
}

export function buildSceneMapPath(demoMode: boolean, sceneId: string | null): string {
  const base = demoMode ? '/demo/map' : '/map';
  return sceneId === null ? base : `${base}?scene=${encodeURIComponent(sceneId)}`;
}
