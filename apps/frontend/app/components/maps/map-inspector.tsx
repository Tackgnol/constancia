import { pegTargetName } from '@/components/maps/scene-peg-button';
import { Button } from '@/components/ui/button';
import {
  PEG_NUDGE_STEP,
  PEG_NUDGE_STEP_COARSE,
  nudgePoint,
  type NormalizedPoint,
} from '@/lib/map-coordinates';
import type { ScenePegProjection } from '@/lib/map-workspace-projection';

const kindLabel: Record<ScenePegProjection['kind'], string> = {
  event: 'Event',
  npc: 'NPC',
  lore: 'Lore',
};

/**
 * A non-spatial list of every peg, kept in sync with the canvas. Selecting, nudging, inspecting,
 * and deleting all work from here, so no task needs precise pointer placement.
 */
export function MapInspector({
  pegs,
  selectedPegId,
  pending,
  onSelect,
  onMove,
  onDelete,
}: {
  pegs: readonly ScenePegProjection[];
  selectedPegId: string | null;
  pending: boolean;
  onSelect: (pegId: string) => void;
  onMove: (pegId: string, point: NormalizedPoint) => Promise<void>;
  onDelete: (pegId: string) => Promise<void>;
}) {
  if (pegs.length === 0) {
    return (
      <p className="form-hint">
        No pegs on this scene yet. Pick a target below, then click the map to place it.
      </p>
    );
  }

  return (
    <ul className="map-peg-list" aria-label="Pegs on this scene">
      {pegs.map((peg) => {
        const selected = peg.id === selectedPegId;
        const point = { x: peg.x, y: peg.y };

        return (
          <li className={`map-peg-row${selected ? ' is-selected' : ''}`} key={peg.id}>
            <button
              aria-current={selected ? 'true' : undefined}
              className="map-peg-row-select"
              onClick={() => onSelect(peg.id)}
              type="button"
            >
              <span className="map-peg-kind">{kindLabel[peg.kind]}</span>
              <span className="map-peg-name">{pegTargetName(peg)}</span>
              <span className="map-peg-position">
                {Math.round(peg.x * 100)}%, {Math.round(peg.y * 100)}%
              </span>
            </button>

            {selected ? (
              <div className="map-peg-row-actions">
                {(
                  [
                    ['Left', -PEG_NUDGE_STEP, 0],
                    ['Right', PEG_NUDGE_STEP, 0],
                    ['Up', 0, -PEG_NUDGE_STEP],
                    ['Down', 0, PEG_NUDGE_STEP],
                  ] as const
                ).map(([label, deltaX, deltaY]) => (
                  <Button
                    aria-label={`Nudge ${pegTargetName(peg)} ${label.toLowerCase()}`}
                    disabled={pending}
                    key={label}
                    onClick={() => void onMove(peg.id, nudgePoint(point, deltaX, deltaY))}
                    type="button"
                    variant="ghost"
                  >
                    {label}
                  </Button>
                ))}
                <Button
                  aria-label={`Remove peg for ${pegTargetName(peg)}`}
                  disabled={pending}
                  onClick={() => void onDelete(peg.id)}
                  type="button"
                  variant="ghost"
                >
                  Remove
                </Button>
                <span className="form-hint">
                  Arrow keys move the selected peg by {PEG_NUDGE_STEP * 100}%, or{' '}
                  {PEG_NUDGE_STEP_COARSE * 100}% with Shift.
                </span>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
