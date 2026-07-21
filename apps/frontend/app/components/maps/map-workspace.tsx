import { useEffect, useRef, useState } from 'react';
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
import { useDemoSceneCommands } from '@/lib/demo-scene-commands';
import type { FireReceiptView } from '@/lib/fire-event-receipt';
import { useLiveSceneCommands } from '@/lib/live-scene-commands';
import type { NormalizedPoint } from '@/lib/map-coordinates';
import type {
  ArmedFireAttempt,
  MapCandidate,
  MapWorkspaceProjection,
  SceneCommands,
  SceneDetailProjection,
  SceneSummaryProjection,
} from '@/lib/map-workspace-projection';

/**
 * Picks the `SceneCommands` implementation for the current route and hands it, already resolved,
 * to the layout component below. This is the one place that knows demo and live exist; `MapWorkspace`
 * itself only ever sees the shared `SceneCommands` contract.
 */
export function MapWorkspaceRoot({ projection }: { projection: MapWorkspaceProjection }) {
  return projection.demoMode ? (
    <DemoMapWorkspace projection={projection} />
  ) : (
    <LiveMapWorkspace projection={projection} />
  );
}

function DemoMapWorkspace({ projection }: { projection: MapWorkspaceProjection }) {
  const { commands, scenes, selectedScene } = useDemoSceneCommands(projection);
  return (
    <MapWorkspace
      commands={commands}
      projection={projection}
      scenes={scenes}
      selectedScene={selectedScene}
    />
  );
}

function LiveMapWorkspace({ projection }: { projection: MapWorkspaceProjection }) {
  const { commands, scenes, selectedScene } = useLiveSceneCommands(projection);
  return (
    <MapWorkspace
      commands={commands}
      projection={projection}
      scenes={scenes}
      selectedScene={selectedScene}
    />
  );
}

/**
 * Layout and interaction state for the Map workspace: armed-placement state, armed-fire
 * idempotency-key state, receipt state, rename-mode toggle, the Escape-key handler, focus
 * management, empty-state copy, and the 3-panel layout. All scene/peg mutation lives behind the
 * `SceneCommands` contract this component is handed — it never builds an implementation itself.
 */
export function MapWorkspace({
  projection,
  commands,
  scenes,
  selectedScene,
}: {
  projection: MapWorkspaceProjection;
  commands: SceneCommands;
  scenes: SceneSummaryProjection[];
  selectedScene: SceneDetailProjection | null;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [armedCandidate, setArmedCandidate] = useState<MapCandidate | null>(null);
  const [selectedPegId, setSelectedPegId] = useState<string | null>(null);
  const [armedFire, setArmedFire] = useState<ArmedFireAttempt | null>(null);
  const [receipt, setReceipt] = useState<FireReceiptView | null>(null);
  const inspectorHeadingRef = useRef<HTMLParagraphElement | null>(null);

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

      {/* One polite region announces the outcome of whichever control the user just used. */}
      <p aria-live="polite" className="map-live-region">
        {commands.pending ? 'Working…' : (commands.status ?? '')}
      </p>

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
              {/* An unreachable service is a different problem from an empty campaign. */}
              {projection.errorMessage !== null ? (
                <>
                  <h2>Scenes are unavailable right now.</h2>
                  <p>Nothing has been lost. Refresh once the connection is back.</p>
                </>
              ) : scenes.length === 0 ? (
                <>
                  <h2>No scenes yet.</h2>
                  <p>Create your first scene on the left, then upload a map for it.</p>
                </>
              ) : (
                <>
                  <h2>That scene is no longer available.</h2>
                  <p>It may have been deleted elsewhere. Pick another from the index.</p>
                </>
              )}
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
          <p className="detail-label" ref={inspectorHeadingRef} tabIndex={-1}>
            Pegs
          </p>
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
                  // Focus would otherwise be lost on the removed button; put it somewhere real.
                  inspectorHeadingRef.current?.focus();
                }}
                onMove={(pegId, point) => commands.movePeg(selectedScene.id, pegId, point)}
                onSelect={setSelectedPegId}
                pegs={selectedScene.pegs}
                pending={commands.pending}
                receipt={receipt}
                selectedPegId={selectedPegId}
              />

              {selectedScene.mapUrl === null ? (
                <p className="form-hint">Upload a map for this scene before placing pegs on it.</p>
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
