import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { demoSceneFixtures, toDemoSceneSummary } from './demo-map-data.js';
import type { FireReceiptView } from './fire-event-receipt.js';
import type { NormalizedPoint } from './map-coordinates.js';
import {
  assembleScenePeg,
  buildSceneMapPath,
  nextSceneAfterRemoval,
  selectSceneId,
  type ArmedFireAttempt,
  type MapCandidate,
  type MapWorkspaceProjection,
  type SceneCommands,
  type SceneDetailProjection,
  type ScenePegProjection,
  type SceneSummaryProjection,
} from './map-workspace-projection.js';

/** Mirrors the backend's scene-name normalization; demo has no backend to defer to for this. */
function normalizeDemoSceneName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function buildDemoScenePeg(
  candidate: MapCandidate,
  point: NormalizedPoint,
): ScenePegProjection {
  const id = `demo-peg-${crypto.randomUUID()}`;

  switch (candidate.kind) {
    case 'event':
      return assembleScenePeg(id, point, {
        kind: 'event',
        target: { id: candidate.id, name: candidate.label, status: 'ready' },
      });
    case 'npc':
      return assembleScenePeg(id, point, {
        kind: 'npc',
        target: { id: candidate.id, name: candidate.label, imageUrl: null },
      });
    case 'lore':
      return assembleScenePeg(id, point, {
        kind: 'lore',
        target: { id: candidate.id, title: candidate.label },
      });
  }
}

/**
 * The demo implementation of `SceneCommands`. Demo Map never calls the scene or upload APIs, so
 * this owns a single client-side store — one ordered list of full scene detail, seeded once from
 * the fixtures in `demo-map-data.ts` — instead of keeping a separate summary list and a detail map
 * in sync by hand. `hasMap`/`pegCount` are always derived from that one list (see
 * `toDemoSceneSummary`), so placing or removing a peg, or attaching/removing a map, can never leave
 * them stale.
 *
 * Selection is derived from the `?scene=` search param against this store on every render, rather
 * than trusted from the loader's `projection.selectedScene`: the loader re-derives its projection
 * from the static fixtures on every navigation, so it has no way to know about a scene created
 * during this session. Reading the search param directly keeps a freshly created scene selectable
 * immediately after `create` navigates to it.
 */
export function useDemoSceneCommands(_projection: MapWorkspaceProjection): {
  commands: SceneCommands;
  scenes: SceneSummaryProjection[];
  selectedScene: SceneDetailProjection | null;
} {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [store, setStore] = useState<SceneDetailProjection[]>(demoSceneFixtures);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Record<string, FireReceiptView>>({});
  const clearError = () => setError(null);

  const scenes = useMemo(() => store.map(toDemoSceneSummary), [store]);
  const selectedSceneId = selectSceneId(scenes, searchParams.get('scene'));
  const selectedScene = store.find((scene) => scene.id === selectedSceneId) ?? null;

  const previewUrls = useRef(new Map<string, string>());
  const revokePreview = (sceneId: string) => {
    const existing = previewUrls.current.get(sceneId);
    if (existing !== undefined) {
      URL.revokeObjectURL(existing);
      previewUrls.current.delete(sceneId);
    }
  };

  // Any previews still held when the workspace unmounts would outlive the page session otherwise.
  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      for (const url of urls.values()) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  const updateScene = (
    sceneId: string,
    update: (current: SceneDetailProjection) => SceneDetailProjection,
  ) => {
    setStore((current) => current.map((scene) => (scene.id === sceneId ? update(scene) : scene)));
  };

  const commands: SceneCommands = {
    // Demo mutations are synchronous page-session state, so nothing here is ever mid-flight.
    pending: false,
    error,
    status,
    quotaWarning: null,
    clearError,
    create: async (name) => {
      const normalized = normalizeDemoSceneName(name);
      const scene: SceneDetailProjection = {
        id: `demo-scene-${crypto.randomUUID()}`,
        name: normalized,
        mapUrl: null,
        pegs: [],
      };
      setStatus(`Scene "${normalized}" created.`);
      setStore((current) => [...current, scene]);
      await navigate(buildSceneMapPath(true, scene.id));
      return true;
    },
    rename: async (sceneId, name) => {
      const normalized = normalizeDemoSceneName(name);
      updateScene(sceneId, (current) => ({ ...current, name: normalized }));
      setStatus(`Scene renamed to "${normalized}".`);
      return true;
    },
    remove: async (sceneId) => {
      setStatus('Scene deleted. Its targets were kept.');
      const next = nextSceneAfterRemoval(scenes, sceneId);
      setStore((current) => current.filter((scene) => scene.id !== sceneId));
      await navigate(buildSceneMapPath(true, next));
      return true;
    },
    // Demo never calls the upload API; the chosen file is previewed from the page session. Each
    // preview URL pins its File in memory, so the one it replaces is revoked.
    replaceMap: async (sceneId, file) => {
      const preview = URL.createObjectURL(file);
      revokePreview(sceneId);
      previewUrls.current.set(sceneId, preview);
      updateScene(sceneId, (current) => ({ ...current, mapUrl: preview }));
      return true;
    },
    removeMap: async (sceneId) => {
      setStatus('Map removed. Peg positions were kept.');
      revokePreview(sceneId);
      updateScene(sceneId, (current) => ({ ...current, mapUrl: null }));
      return true;
    },
    createPeg: async (sceneId, candidate, point) => {
      setStatus(`${candidate.label} placed.`);
      updateScene(sceneId, (current) =>
        current.pegs.some((peg) => peg.target.id === candidate.id)
          ? current
          : { ...current, pegs: [...current.pegs, buildDemoScenePeg(candidate, point)] },
      );
      return true;
    },
    movePeg: async (sceneId, pegId, point) => {
      setStatus('Peg moved.');
      updateScene(sceneId, (current) => ({
        ...current,
        pegs: current.pegs.map((peg) => (peg.id === pegId ? { ...peg, ...point } : peg)),
      }));
      return true;
    },
    removePeg: async (sceneId, pegId) => {
      setStatus('Peg removed.');
      updateScene(sceneId, (current) => ({
        ...current,
        pegs: current.pegs.filter((peg) => peg.id !== pegId),
      }));
      return true;
    },
    // Demo keys the receipt off the idempotency key, mirroring the backend's collapse.
    fireEvent: async (attempt: ArmedFireAttempt) => {
      const existing = receipts[attempt.idempotencyKey];
      if (existing) {
        return existing;
      }

      const created: FireReceiptView = {
        eventId: attempt.eventId,
        executionId: `demo-execution-${attempt.idempotencyKey}`,
        executionStatus: 'completed',
        deliveryStatus: 'delivered',
      };
      setReceipts((current) => ({ ...current, [attempt.idempotencyKey]: created }));
      return created;
    },
  };

  // `projection` itself carries no session state in demo mode (it is re-derived from the static
  // fixtures on every navigation); the parameter exists only so this hook has the same call shape
  // as `useLiveSceneCommands` and can be swapped in by whichever caller picks the implementation.
  return { commands, scenes, selectedScene };
}
