import { useState } from 'react';
import { useNavigate, useRevalidator } from 'react-router';
import { ManagementWorkspace } from '@/components/layout/management-workspace';
import { SceneForm } from '@/components/maps/scene-form';
import { SceneIndex } from '@/components/maps/scene-index';
import { SetupNotice } from '@/components/setup/setup-notice';
import { Button } from '@/components/ui/button';
import { postRouteAction } from '@/lib/route-action-client';
import {
  buildSceneMapPath,
  nextSceneAfterRemoval,
  type MapWorkspaceProjection,
  type SceneSummaryProjection,
} from '@/lib/map-workspace-projection';

interface SceneCommands {
  create: (name: string) => Promise<void>;
  rename: (sceneId: string, name: string) => Promise<void>;
  remove: (sceneId: string) => Promise<void>;
  pending: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Live commands post to the map route action and let React Router revalidate the loader; demo
 * commands mutate page-session state. Both expose the same shape so components stay identical.
 */
function useSceneCommands(projection: MapWorkspaceProjection): {
  commands: SceneCommands;
  scenes: SceneSummaryProjection[];
} {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoScenes, setDemoScenes] = useState<SceneSummaryProjection[]>(projection.scenes);

  const scenes = projection.demoMode ? demoScenes : projection.scenes;
  const clearError = () => setError(null);

  const runLive = async (
    values: Record<string, string>,
    onDone: (sceneId: string | undefined) => Promise<void> | void,
  ) => {
    if (projection.campaignId === null) {
      setError('Reopen Map so we can identify your campaign, then try again.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await postRouteAction<{ sceneId: string }>('/map', {
        ...values,
        campaignId: projection.campaignId,
      });

      if (response.status !== 'success') {
        setError(response.message);
        return;
      }

      await onDone(response.data?.sceneId);
    } finally {
      setPending(false);
    }
  };

  if (projection.demoMode) {
    return {
      scenes,
      commands: {
        pending,
        error,
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
        },
        remove: async (sceneId) => {
          setDemoScenes((current) => current.filter((scene) => scene.id !== sceneId));
          await navigate(buildSceneMapPath(true, nextSceneAfterRemoval(scenes, sceneId)));
        },
      },
    };
  }

  return {
    scenes,
    commands: {
      pending,
      error,
      clearError,
      create: (name) =>
        runLive({ intent: 'create-scene', name }, async (sceneId) => {
          await navigate(buildSceneMapPath(false, sceneId ?? null));
        }),
      rename: (sceneId, name) =>
        runLive({ intent: 'rename-scene', sceneId, name }, () => {
          revalidator.revalidate();
        }),
      remove: (sceneId) =>
        runLive({ intent: 'delete-scene', sceneId }, async () => {
          await navigate(buildSceneMapPath(false, nextSceneAfterRemoval(scenes, sceneId)));
        }),
    },
  };
}

export function MapWorkspace({ projection }: { projection: MapWorkspaceProjection }) {
  const { commands, scenes } = useSceneCommands(projection);
  const [isRenaming, setIsRenaming] = useState(false);
  const selectedScene = projection.selectedScene;

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
                  <p>Uploading a map image arrives in the next step of this workspace.</p>
                </div>
              ) : (
                <img
                  alt={`Map for ${selectedScene.name}`}
                  className="map-canvas-image"
                  src={selectedScene.mapUrl}
                />
              )}
            </>
          )}
        </section>

        <aside className="map-inspector-panel" aria-label="Peg inspector">
          <p className="detail-label">Pegs</p>
          {selectedScene && selectedScene.pegs.length > 0 ? (
            <ul className="map-peg-list">
              {selectedScene.pegs.map((peg) => (
                <li key={peg.id}>
                  <span className="map-peg-kind">{peg.kind}</span>{' '}
                  {peg.kind === 'lore' ? peg.target.title : peg.target.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="form-hint">Peg placement and inspection arrive in the next step.</p>
          )}
        </aside>
      </div>
    </ManagementWorkspace>
  );
}
