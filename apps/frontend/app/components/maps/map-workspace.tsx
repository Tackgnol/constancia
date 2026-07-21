import { useEffect, useState } from 'react';
import { useNavigate, useRevalidator } from 'react-router';
import { ManagementWorkspace } from '@/components/layout/management-workspace';
import { MapCandidatePicker } from '@/components/maps/map-candidate-picker';
import { MapInspector } from '@/components/maps/map-inspector';
import { MapViewport } from '@/components/maps/map-viewport';
import { SceneForm } from '@/components/maps/scene-form';
import { SceneIndex } from '@/components/maps/scene-index';
import { SceneMapForm } from '@/components/maps/scene-map-form';
import { ScenePegButton } from '@/components/maps/scene-peg-button';
import { SetupNotice } from '@/components/setup/setup-notice';
import { Button } from '@/components/ui/button';
import { postRouteAction } from '@/lib/route-action-client';
import type { FireReceiptView } from '@/lib/fire-event-receipt';
import type { NormalizedPoint } from '@/lib/map-coordinates';
import {
  buildSceneMapPath,
  nextSceneAfterRemoval,
  type MapCandidate,
  type MapWorkspaceProjection,
  type SceneDetailProjection,
  type ScenePegProjection,
  type SceneSummaryProjection,
} from '@/lib/map-workspace-projection';

interface UploadQuota {
  uploadRemainingBytes: number;
  uploadUsagePercent: number;
  uploadNearLimit: boolean;
}

interface MapActionData {
  sceneId?: string;
  pegId?: string;
  quota?: UploadQuota;
  duplicateTarget?: boolean;
  receipt?: FireReceiptView;
}

/**
 * One key per armed attempt. Retrying an ambiguous failure reuses it so the backend collapses the
 * repeat onto the same execution; arming again mints a new one.
 */
interface ArmedFireAttempt {
  pegId: string;
  eventId: string;
  idempotencyKey: string;
}

interface SceneCommands {
  create: (name: string) => Promise<void>;
  rename: (sceneId: string, name: string) => Promise<void>;
  remove: (sceneId: string) => Promise<void>;
  replaceMap: (sceneId: string, file: File) => Promise<void>;
  removeMap: (sceneId: string) => Promise<void>;
  createPeg: (sceneId: string, candidate: MapCandidate, point: NormalizedPoint) => Promise<void>;
  movePeg: (sceneId: string, pegId: string, point: NormalizedPoint) => Promise<void>;
  removePeg: (sceneId: string, pegId: string) => Promise<void>;
  fireEvent: (attempt: ArmedFireAttempt) => Promise<FireReceiptView | null>;
  pending: boolean;
  error: string | null;
  quotaWarning: string | null;
  clearError: () => void;
}

function demoPeg(candidate: MapCandidate, point: NormalizedPoint): ScenePegProjection {
  const id = `demo-peg-${crypto.randomUUID()}`;

  switch (candidate.kind) {
    case 'event':
      return {
        id,
        kind: 'event',
        ...point,
        target: { id: candidate.id, name: candidate.label, status: 'ready' },
      };
    case 'npc':
      return {
        id,
        kind: 'npc',
        ...point,
        target: { id: candidate.id, name: candidate.label, imageUrl: null },
      };
    case 'lore':
      return { id, kind: 'lore', ...point, target: { id: candidate.id, title: candidate.label } };
  }
}

function formatQuotaWarning(quota: UploadQuota | undefined): string | null {
  if (!quota?.uploadNearLimit) {
    return null;
  }

  const remainingMb = Math.max(quota.uploadRemainingBytes, 0) / (1024 * 1024);
  return `Upload allowance is ${quota.uploadUsagePercent}% used. About ${remainingMb.toFixed(1)} MB remain.`;
}

/**
 * Live commands post to the map route action and let React Router revalidate the loader; demo
 * commands mutate page-session state. Both expose the same shape so components stay identical.
 * Demo detail overrides are keyed by scene id so navigating between scenes keeps each one's edits.
 */
function useSceneCommands(projection: MapWorkspaceProjection): {
  commands: SceneCommands;
  scenes: SceneSummaryProjection[];
  selectedScene: SceneDetailProjection | null;
} {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
  const [demoScenes, setDemoScenes] = useState<SceneSummaryProjection[]>(projection.scenes);
  const [demoDetails, setDemoDetails] = useState<Record<string, SceneDetailProjection>>({});
  const [demoReceipts, setDemoReceipts] = useState<Record<string, FireReceiptView>>({});

  const scenes = projection.demoMode ? demoScenes : projection.scenes;
  const selectedScene =
    projection.demoMode && projection.selectedScene !== null
      ? (demoDetails[projection.selectedScene.id] ?? projection.selectedScene)
      : projection.selectedScene;
  const clearError = () => setError(null);

  const runLive = async (
    values: Record<string, FormDataEntryValue>,
    onDone: (data: MapActionData | undefined) => Promise<void> | void,
  ) => {
    if (projection.campaignId === null) {
      setError('Reopen Map so we can identify your campaign, then try again.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await postRouteAction<MapActionData>('/map', {
        ...values,
        campaignId: projection.campaignId,
      });

      if (response.status !== 'success') {
        setError(response.message);
        return;
      }

      setQuotaWarning(formatQuotaWarning(response.data?.quota));
      await onDone(response.data);
    } finally {
      setPending(false);
    }
  };

  const setDemoDetail = (
    sceneId: string,
    update: (current: SceneDetailProjection) => SceneDetailProjection,
  ) => {
    const base = demoDetails[sceneId] ?? projection.selectedScene;
    if (base === null || base.id !== sceneId) {
      return;
    }

    const next = update(base);
    setDemoDetails((current) => ({ ...current, [sceneId]: next }));
    setDemoScenes((current) =>
      current.map((scene) =>
        scene.id === sceneId ? { ...scene, hasMap: next.mapUrl !== null } : scene,
      ),
    );
  };

  if (projection.demoMode) {
    return {
      scenes,
      selectedScene,
      commands: {
        pending,
        error,
        quotaWarning,
        clearError,
        create: async (name) => {
          const scene = {
            id: `demo-scene-${crypto.randomUUID()}`,
            name,
            hasMap: false,
            pegCount: 0,
          };
          setDemoScenes((current) => [...current, scene]);
          await navigate(buildSceneMapPath(true, scene.id));
        },
        rename: async (sceneId, name) => {
          setDemoScenes((current) =>
            current.map((scene) => (scene.id === sceneId ? { ...scene, name } : scene)),
          );
          setDemoDetail(sceneId, (current) => ({ ...current, name }));
        },
        remove: async (sceneId) => {
          setDemoScenes((current) => current.filter((scene) => scene.id !== sceneId));
          await navigate(buildSceneMapPath(true, nextSceneAfterRemoval(scenes, sceneId)));
        },
        // Demo never calls the upload API; the chosen file is previewed from the page session.
        replaceMap: async (sceneId, file) => {
          setDemoDetail(sceneId, (current) => ({
            ...current,
            mapAssetId: `demo-map-${sceneId}`,
            mapUrl: URL.createObjectURL(file),
          }));
        },
        removeMap: async (sceneId) => {
          setDemoDetail(sceneId, (current) => ({
            ...current,
            mapAssetId: null,
            mapUrl: null,
          }));
        },
        createPeg: async (sceneId, candidate, point) => {
          setDemoDetail(sceneId, (current) =>
            current.pegs.some((peg) => peg.target.id === candidate.id)
              ? current
              : { ...current, pegs: [...current.pegs, demoPeg(candidate, point)] },
          );
        },
        movePeg: async (sceneId, pegId, point) => {
          setDemoDetail(sceneId, (current) => ({
            ...current,
            pegs: current.pegs.map((peg) => (peg.id === pegId ? { ...peg, ...point } : peg)),
          }));
        },
        removePeg: async (sceneId, pegId) => {
          setDemoDetail(sceneId, (current) => ({
            ...current,
            pegs: current.pegs.filter((peg) => peg.id !== pegId),
          }));
        },
        // Demo keys the receipt off the idempotency key, mirroring the backend's collapse.
        fireEvent: async (attempt) => {
          const existing = demoReceipts[attempt.idempotencyKey];
          if (existing) {
            return existing;
          }

          const created: FireReceiptView = {
            eventId: attempt.eventId,
            executionId: `demo-execution-${attempt.idempotencyKey}`,
            executionStatus: 'completed',
            deliveryStatus: 'delivered',
          };
          setDemoReceipts((current) => ({ ...current, [attempt.idempotencyKey]: created }));
          return created;
        },
      },
    };
  }

  return {
    scenes,
    selectedScene,
    commands: {
      pending,
      error,
      quotaWarning,
      clearError,
      create: (name) =>
        runLive({ intent: 'create-scene', name }, async (data) => {
          await navigate(buildSceneMapPath(false, data?.sceneId ?? null));
        }),
      rename: (sceneId, name) =>
        runLive({ intent: 'rename-scene', sceneId, name }, () => {
          revalidator.revalidate();
        }),
      remove: (sceneId) =>
        runLive({ intent: 'delete-scene', sceneId }, async () => {
          await navigate(buildSceneMapPath(false, nextSceneAfterRemoval(scenes, sceneId)));
        }),
      replaceMap: (sceneId, file) =>
        runLive({ intent: 'replace-scene-map', sceneId, file }, () => {
          revalidator.revalidate();
        }),
      removeMap: (sceneId) =>
        runLive({ intent: 'delete-scene-map', sceneId }, () => {
          revalidator.revalidate();
        }),
      createPeg: (sceneId, candidate, point) =>
        runLive(
          {
            intent: 'create-scene-peg',
            sceneId,
            kind: candidate.kind,
            targetId: candidate.id,
            x: String(point.x),
            y: String(point.y),
          },
          () => {
            revalidator.revalidate();
          },
        ),
      movePeg: (sceneId, pegId, point) =>
        runLive(
          { intent: 'move-scene-peg', sceneId, pegId, x: String(point.x), y: String(point.y) },
          () => {
            revalidator.revalidate();
          },
        ),
      removePeg: (sceneId, pegId) =>
        runLive({ intent: 'delete-scene-peg', sceneId, pegId }, () => {
          revalidator.revalidate();
        }),
      fireEvent: async (attempt) => {
        let fired: FireReceiptView | null = null;
        await runLive(
          {
            intent: 'fire-event',
            eventId: attempt.eventId,
            idempotencyKey: attempt.idempotencyKey,
          },
          (data) => {
            fired = data?.receipt ?? null;
          },
        );

        return fired;
      },
    },
  };
}

export function MapWorkspace({ projection }: { projection: MapWorkspaceProjection }) {
  const { commands, scenes, selectedScene } = useSceneCommands(projection);
  const [isRenaming, setIsRenaming] = useState(false);
  const [armedCandidate, setArmedCandidate] = useState<MapCandidate | null>(null);
  const [selectedPegId, setSelectedPegId] = useState<string | null>(null);
  const [armedFire, setArmedFire] = useState<ArmedFireAttempt | null>(null);
  const [receipt, setReceipt] = useState<FireReceiptView | null>(null);

  // Escape always cancels an armed placement, so the map never stays stuck in placing mode.
  useEffect(() => {
    if (armedCandidate === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setArmedCandidate(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [armedCandidate]);

  const placeArmedCandidate = async (point: NormalizedPoint) => {
    if (selectedScene === null || armedCandidate === null) {
      return;
    }

    const candidate = armedCandidate;
    setArmedCandidate(null);
    await commands.createPeg(selectedScene.id, candidate, point);

    // On a duplicate the peg already exists; select it rather than reporting a failure.
    const existing = selectedScene.pegs.find((peg) => peg.target.id === candidate.id);
    if (existing) {
      setSelectedPegId(existing.id);
    }
  };

  return (
    <ManagementWorkspace
      eyebrow="Map"
      title="Scenes and maps"
      description="Keep a persistent map per scene and pin the events, NPCs, and lore that live on it."
      meta={
        <div className="log-hero-meta">
          <p className="detail-label">Map scope</p>
          <strong>
            {scenes.length} scene{scenes.length === 1 ? '' : 's'}
          </strong>
          <span>{selectedScene?.name ?? 'Nothing selected'}</span>
        </div>
      }
    >
      {projection.errorMessage ? (
        <SetupNotice label="Map unavailable" tone="error">
          <span>{projection.errorMessage}</span>
        </SetupNotice>
      ) : null}

      {commands.error ? (
        <SetupNotice label="Scene warning" tone="error">
          <span>{commands.error}</span>
          <Button onClick={commands.clearError} type="button" variant="ghost">
            Dismiss
          </Button>
        </SetupNotice>
      ) : null}

      <div className="map-workspace">
        <aside className="map-scene-panel" aria-label="Scene index">
          <SceneIndex
            demoMode={projection.demoMode}
            onDelete={(sceneId) => void commands.remove(sceneId)}
            pending={commands.pending}
            scenes={scenes}
            selectedSceneId={selectedScene?.id ?? null}
          />
          <SceneForm
            label="New scene"
            onSubmit={commands.create}
            pending={commands.pending}
            pendingLabel="Creating…"
            submitLabel="Create scene"
          />
        </aside>

        <section className="map-canvas-panel" aria-label="Scene map">
          {selectedScene === null ? (
            <div className="detail-card board-empty-state">
              <h2>No scene selected.</h2>
              <p>Create a scene, or pick one from the index, to start building its map.</p>
            </div>
          ) : (
            <>
              <header className="map-canvas-header">
                {isRenaming ? (
                  <SceneForm
                    defaultName={selectedScene.name}
                    label="Rename scene"
                    onCancel={() => setIsRenaming(false)}
                    onSubmit={async (name) => {
                      await commands.rename(selectedScene.id, name);
                      setIsRenaming(false);
                    }}
                    pending={commands.pending}
                    pendingLabel="Saving…"
                    submitLabel="Save name"
                  />
                ) : (
                  <>
                    <h2>{selectedScene.name}</h2>
                    <Button onClick={() => setIsRenaming(true)} type="button" variant="ghost">
                      Rename
                    </Button>
                  </>
                )}
              </header>

              {selectedScene.mapUrl === null ? (
                <div className="detail-card board-empty-state">
                  <h2>This scene has no map yet.</h2>
                  <p>Upload one below to start pinning events, NPCs, and lore to it.</p>
                </div>
              ) : (
                <MapViewport
                  imageAlt={`Map of ${selectedScene.name}`}
                  imageUrl={selectedScene.mapUrl}
                  onPlace={(point) => void placeArmedCandidate(point)}
                  placementActive={armedCandidate !== null}
                >
                  {selectedScene.pegs.map((peg) => (
                    <ScenePegButton
                      key={peg.id}
                      onMove={(point) => commands.movePeg(selectedScene.id, peg.id, point)}
                      onSelect={() => setSelectedPegId(peg.id)}
                      peg={peg}
                      selected={peg.id === selectedPegId}
                    />
                  ))}
                </MapViewport>
              )}

              <SceneMapForm
                hasMap={selectedScene.mapUrl !== null}
                onRemove={() => commands.removeMap(selectedScene.id)}
                onReplace={(file) => commands.replaceMap(selectedScene.id, file)}
                pending={commands.pending}
                quotaWarning={commands.quotaWarning}
                sceneName={selectedScene.name}
              />
            </>
          )}
        </section>

        <aside className="map-inspector-panel" aria-label="Peg inspector">
          <p className="detail-label">Pegs</p>
          {selectedScene === null ? (
            <p className="form-hint">Select a scene to see its pegs.</p>
          ) : (
            <>
              <MapInspector
                armedEvent={armedFire}
                demoMode={projection.demoMode}
                onArm={(peg) => {
                  setReceipt(null);
                  // A fresh arm always mints a new key, so it can never reuse a spent execution.
                  setArmedFire({
                    pegId: peg.id,
                    eventId: peg.target.id,
                    idempotencyKey: crypto.randomUUID(),
                  });
                }}
                onCancelArm={() => setArmedFire(null)}
                onConfirmFire={async () => {
                  if (armedFire === null) {
                    return;
                  }

                  const fired = await commands.fireEvent(armedFire);
                  // A failed confirm keeps the attempt armed with the same key, so a retry
                  // collapses onto the same execution rather than starting a second one.
                  if (fired !== null) {
                    setReceipt(fired);
                    setArmedFire(null);
                  }
                }}
                onDelete={async (pegId) => {
                  await commands.removePeg(selectedScene.id, pegId);
                  setSelectedPegId(null);
                }}
                onMove={(pegId, point) => commands.movePeg(selectedScene.id, pegId, point)}
                onSelect={setSelectedPegId}
                pegs={selectedScene.pegs}
                pending={commands.pending}
                receipt={receipt}
                selectedPegId={selectedPegId}
              />

              {selectedScene.mapUrl === null ? (
                <p className="form-hint">Upload a map before placing pegs on it.</p>
              ) : (
                <MapCandidatePicker
                  armedCandidate={armedCandidate}
                  candidates={projection.candidates}
                  disabled={commands.pending}
                  onArm={setArmedCandidate}
                  onCancel={() => setArmedCandidate(null)}
                  pegs={selectedScene.pegs}
                />
              )}
            </>
          )}
        </aside>
      </div>
    </ManagementWorkspace>
  );
}
