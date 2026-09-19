import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pencil } from 'lucide-react';
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

function SceneIndexPanel({
  commands,
  demoMode,
  scenes,
  selectedScene,
  isRenaming,
  open,
  onOpenChange,
  onRenamingChange,
}: {
  commands: SceneCommands;
  demoMode: boolean;
  scenes: SceneSummaryProjection[];
  selectedScene: SceneDetailProjection | null;
  isRenaming: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamingChange: (renaming: boolean) => void;
}) {
  return (
    <section
      aria-label="Scene index"
      className={`map-panel map-panel-scenes${open ? '' : ' is-collapsed'}`}
    >
      <div className="map-panel-header">
        <div className="map-panel-heading">
          <p className="detail-label">Scenes · {scenes.length}</p>
          {selectedScene !== null && !isRenaming ? (
            <div className="map-panel-heading-row">
              <h2>{selectedScene.name}</h2>
              <Button
                aria-label="Rename scene"
                className="icon-hit-44"
                onClick={() => onRenamingChange(true)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Pencil aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </div>
        <Button
          aria-label={open ? 'Collapse scenes panel' : 'Expand scenes panel'}
          className="icon-hit-44"
          onClick={() => onOpenChange(!open)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {open ? <ChevronLeft aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        </Button>
      </div>

      {open ? (
        <div className="map-panel-body">
          {selectedScene !== null && isRenaming ? (
            <SceneForm
              compact
              defaultName={selectedScene.name}
              label="Rename scene"
              onCancel={() => onRenamingChange(false)}
              onSubmit={async (name) => {
                await commands.rename(selectedScene.id, name);
                onRenamingChange(false);
              }}
              pending={commands.pending}
              pendingLabel="Saving…"
              submitLabel="Save"
            />
          ) : null}

          <SceneIndex
            demoMode={demoMode}
            onDelete={(sceneId) => void commands.remove(sceneId)}
            pending={commands.pending}
            scenes={scenes}
            selectedSceneId={selectedScene?.id ?? null}
          />
          <SceneForm
            compact
            label="New scene"
            onSubmit={commands.create}
            pending={commands.pending}
            pendingLabel="Creating…"
            submitLabel="Add"
          />
        </div>
      ) : null}
    </section>
  );
}

/**
 * Layout and interaction state for the Map workspace: armed-placement state, armed-fire
 * idempotency-key state, receipt state, rename-mode toggle, the Escape-key handler, focus
 * management, empty-state copy, and the 3-panel layout. All scene/peg mutation lives behind the
 * `SceneCommands` contract this component is handed — it never builds an implementation itself.
 * Only reached through `MapWorkspaceRoot` above, which picks the demo or live commands.
 */
function MapWorkspace({
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
  const [scenesOpen, setScenesOpen] = useState(true);
  const [placeOpen, setPlaceOpen] = useState(true);
  const [pegsOpen, setPegsOpen] = useState(true);
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

      {selectedScene !== null ? (
        <div className="map-upload-bar">
          <SceneMapForm
            hasMap={selectedScene.mapUrl !== null}
            onRemove={() => commands.removeMap(selectedScene.id)}
            onReplace={(file) => commands.replaceMap(selectedScene.id, file)}
            pending={commands.pending}
            quotaWarning={commands.quotaWarning}
            sceneName={selectedScene.name}
          />
        </div>
      ) : null}

      <div className="map-workspace">
        <section aria-label="Scene map" className="map-canvas-full">
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
                  <p>Create your first scene in the Scenes panel, then upload a map for it.</p>
                </>
              ) : (
                <>
                  <h2>That scene is no longer available.</h2>
                  <p>It may have been deleted elsewhere. Pick another from the index.</p>
                </>
              )}
            </div>
          ) : selectedScene.mapUrl === null ? (
            <div className="detail-card board-empty-state">
              <h2>This scene has no map yet.</h2>
              <p>Upload one above to start pinning events, NPCs, and lore to it.</p>
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
        </section>

        <SceneIndexPanel
          commands={commands}
          demoMode={projection.demoMode}
          scenes={scenes}
          selectedScene={selectedScene}
          isRenaming={isRenaming}
          open={scenesOpen}
          onOpenChange={setScenesOpen}
          onRenamingChange={setIsRenaming}
        />

        {selectedScene !== null ? (
          <>
            <section
              aria-label="Place a target"
              className={`map-panel map-panel-place${placeOpen ? '' : ' is-collapsed'}`}
            >
              <div className="map-panel-header">
                <p className="detail-label">Place on map</p>
                <Button
                  aria-label={
                    placeOpen ? 'Collapse place-on-map panel' : 'Expand place-on-map panel'
                  }
                  className="icon-hit-44"
                  onClick={() => setPlaceOpen((open) => !open)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  {placeOpen ? (
                    <ChevronRight aria-hidden="true" />
                  ) : (
                    <ChevronLeft aria-hidden="true" />
                  )}
                </Button>
              </div>

              {placeOpen ? (
                <div className="map-panel-body">
                  {selectedScene.mapUrl === null ? (
                    <p className="form-hint">
                      Upload a map for this scene before placing pegs on it.
                    </p>
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
                </div>
              ) : null}
            </section>

            <section
              aria-label="Peg inspector"
              className={`map-panel map-panel-pegs${pegsOpen ? '' : ' is-collapsed'}`}
            >
              <div className="map-panel-header">
                <p className="detail-label" ref={inspectorHeadingRef} tabIndex={-1}>
                  On this map · {selectedScene.pegs.length}
                </p>
                <Button
                  aria-label={pegsOpen ? 'Collapse pegs panel' : 'Expand pegs panel'}
                  className="icon-hit-44"
                  onClick={() => setPegsOpen((open) => !open)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  {pegsOpen ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
                </Button>
              </div>

              {pegsOpen ? (
                <div className="map-panel-body">
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
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </ManagementWorkspace>
  );
}
