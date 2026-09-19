import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { NO_PAN_CLASS } from '@/components/maps/map-viewport';
import { useMapImageRect } from '@/hooks/use-map-image-rect';
import {
  arrowKeyDelta,
  normalizePointInRect,
  nudgePoint,
  pointsAreEqual,
  toPercentPosition,
  type NormalizedPoint,
} from '@/lib/map-coordinates';
import { pegTargetName, type ScenePegProjection } from '@/lib/map-workspace-projection';

const pegKindLabel: Record<ScenePegProjection['kind'], string> = {
  event: 'Event',
  npc: 'NPC',
  lore: 'Lore',
};

/** Peg kind is carried by shape, letter, and accessible name — never by colour alone. */
const pegKindGlyph: Record<ScenePegProjection['kind'], string> = {
  event: 'E',
  npc: 'N',
  lore: 'L',
};

/** Below this the press is treated as a selection click rather than a drag. */
const DRAG_THRESHOLD_PX = 4;

export function ScenePegButton({
  peg,
  selected,
  onSelect,
  onMove,
}: {
  peg: ScenePegProjection;
  selected: boolean;
  onSelect: () => void;
  /** Resolves true when the move was accepted; false rolls the peg back to the loader position. */
  onMove: (point: NormalizedPoint) => Promise<boolean>;
}) {
  const readImageRect = useMapImageRect();
  const loaderPoint = { x: peg.x, y: peg.y };
  const [drag, setDrag] = useState<{ point: NormalizedPoint; base: NormalizedPoint } | null>(null);
  const draggingRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * The override is derived, not synced: it applies only while the loader still reports the point
   * the drag started from. Once revalidation lands a new position the override is stale and the
   * loader wins, which avoids both a flash back to the old spot and a reset-state effect.
   */
  const position =
    drag !== null && pointsAreEqual(drag.base, loaderPoint) ? drag.point : loaderPoint;

  const setDragPoint = (point: NormalizedPoint | null) =>
    setDrag(point === null ? null : { point, base: loaderPoint });

  const pointFromEvent = (event: { clientX: number; clientY: number }): NormalizedPoint | null => {
    const rect = readImageRect();
    return rect === null ? null : normalizePointInRect(event.clientX, event.clientY, rect);
  };

  const commit = async (next: NormalizedPoint) => {
    if (pointsAreEqual(next, loaderPoint)) {
      setDragPoint(null);
      return;
    }

    setDragPoint(next);
    draggingRef.current = false;

    // A rejected move drops the override immediately, so the peg visibly snaps back to where the
    // loader still has it. A successful one keeps it until revalidation reports the new position.
    if (!(await onMove(next))) {
      setDragPoint(null);
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    onSelect();
    draggingRef.current = true;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) {
      return;
    }

    const next = pointFromEvent(event);
    if (next !== null) {
      setDragPoint(next);
    }
  };

  const onPointerUp = async (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    const start = pointerStartRef.current;
    pointerStartRef.current = null;

    // A press that never travelled is a selection, not a drag. Committing it would nudge the peg
    // by whatever subpixel difference the pointer landed on.
    if (
      start !== null &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) < DRAG_THRESHOLD_PX
    ) {
      draggingRef.current = false;
      setDragPoint(null);
      return;
    }

    await commit(pointFromEvent(event) ?? position);
  };

  return (
    <button
      aria-current={selected ? 'true' : undefined}
      aria-label={`${pegKindLabel[peg.kind]}: ${pegTargetName(peg)}`}
      className={`scene-peg scene-peg-${peg.kind} ${NO_PAN_CLASS}${selected ? ' is-selected' : ''}`}
      data-kind={peg.kind}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        const delta = arrowKeyDelta(event.key, event.shiftKey);
        if (delta === null) {
          return;
        }

        event.preventDefault();
        void commit(nudgePoint(position, delta.deltaX, delta.deltaY));
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
        setDragPoint(null);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => void onPointerUp(event)}
      style={toPercentPosition(position)}
      type="button"
    >
      <span aria-hidden="true" className="scene-peg-glyph">
        {pegKindGlyph[peg.kind]}
      </span>
    </button>
  );
}
