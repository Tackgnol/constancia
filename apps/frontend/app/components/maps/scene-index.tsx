import { X } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { buildSceneMapPath, type SceneSummaryProjection } from '@/lib/map-workspace-projection';

export function SceneIndex({
  scenes,
  selectedSceneId,
  demoMode,
  pending,
  onDelete,
}: {
  scenes: readonly SceneSummaryProjection[];
  selectedSceneId: string | null;
  demoMode: boolean;
  pending: boolean;
  onDelete: (sceneId: string) => void;
}) {
  if (scenes.length === 0) {
    return <p className="form-hint">No scenes yet. Create one to start placing pegs.</p>;
  }

  return (
    <ul className="scene-index" aria-label="Campaign scenes">
      {scenes.map((scene) => {
        const isSelected = scene.id === selectedSceneId;
        return (
          <li className={`scene-index-item${isSelected ? ' is-selected' : ''}`} key={scene.id}>
            <Link
              aria-current={isSelected ? 'true' : undefined}
              className="scene-index-link"
              to={buildSceneMapPath(demoMode, scene.id)}
            >
              <span className="scene-index-name">{scene.name}</span>
              <span className="scene-index-meta">
                {scene.hasMap ? 'Map attached' : 'No map'} · {scene.pegCount} peg
                {scene.pegCount === 1 ? '' : 's'}
              </span>
            </Link>
            <Button
              aria-label={`Delete scene ${scene.name}`}
              className="icon-hit-44"
              disabled={pending}
              onClick={() => onDelete(scene.id)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
