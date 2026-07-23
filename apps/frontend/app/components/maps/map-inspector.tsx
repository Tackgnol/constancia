import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import type { FireReceiptView } from '@/lib/fire-event-receipt';
import {
  PEG_NUDGE_STEP,
  PEG_NUDGE_STEP_COARSE,
  nudgePoint,
  type NormalizedPoint,
} from '@/lib/map-coordinates';
import {
  buildTargetWorkspacePath,
  pegTargetName,
  type ScenePegProjection,
} from '@/lib/map-workspace-projection';

const kindLabel: Record<ScenePegProjection['kind'], string> = {
  event: 'Event',
  npc: 'NPC',
  lore: 'Lore',
};

export interface ArmedEvent {
  pegId: string;
  eventId: string;
}

/**
 * A non-spatial list of every peg, kept in sync with the canvas. Selecting, nudging, inspecting,
 * firing, and deleting all work from here, so no task needs precise pointer placement.
 */
export function MapInspector({
  pegs,
  selectedPegId,
  pending,
  demoMode,
  armedEvent,
  receipt,
  onSelect,
  onMove,
  onDelete,
  onArm,
  onCancelArm,
  onConfirmFire,
}: {
  pegs: readonly ScenePegProjection[];
  selectedPegId: string | null;
  pending: boolean;
  demoMode: boolean;
  armedEvent: ArmedEvent | null;
  receipt: FireReceiptView | null;
  onSelect: (pegId: string) => void;
  onMove: (pegId: string, point: NormalizedPoint) => Promise<unknown>;
  onDelete: (pegId: string) => Promise<unknown>;
  onArm: (peg: ScenePegProjection) => void;
  onCancelArm: () => void;
  onConfirmFire: () => Promise<void>;
}) {
  // The next step depends on whether a map exists, so the caller supplies that guidance below.
  if (pegs.length === 0) {
    return <p className="form-hint">No pegs on this scene yet.</p>;
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
              <span className={`map-peg-kind map-peg-kind-${peg.kind}`}>{kindLabel[peg.kind]}</span>
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

            {selected && peg.kind === 'event' ? (
              <div className="map-peg-detail">
                <p className="form-hint">Status: {peg.target.status}</p>
                {armedEvent?.pegId === peg.id ? (
                  <div className="map-peg-arm" role="group" aria-label="Confirm firing this event">
                    <span className="form-hint">
                      Firing <strong>{peg.target.name}</strong> runs its pipeline and delivers to
                      Discord.
                    </span>
                    <Button disabled={pending} onClick={() => void onConfirmFire()} type="button">
                      {pending ? 'Firing…' : 'Confirm fire'}
                    </Button>
                    <Button disabled={pending} onClick={onCancelArm} type="button" variant="ghost">
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    disabled={pending}
                    onClick={() => onArm(peg)}
                    type="button"
                    variant="outline"
                  >
                    Arm event
                  </Button>
                )}
                {receipt !== null && receipt.eventId === peg.target.id ? (
                  <p className="form-hint" role="status">
                    Execution {receipt.executionStatus}; delivery {receipt.deliveryStatus}.
                  </p>
                ) : null}
              </div>
            ) : null}

            {selected && peg.kind === 'npc' ? (
              <div className="map-peg-detail">
                <Link
                  className="setup-inline-link"
                  to={buildTargetWorkspacePath('npc', peg.target.id, demoMode)}
                >
                  Open {peg.target.name} in NPCs
                </Link>
              </div>
            ) : null}

            {selected && peg.kind === 'lore' ? (
              <div className="map-peg-detail">
                <Link
                  className="setup-inline-link"
                  to={buildTargetWorkspacePath('lore', peg.target.id, demoMode)}
                >
                  Open {peg.target.title} in Lore
                </Link>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
