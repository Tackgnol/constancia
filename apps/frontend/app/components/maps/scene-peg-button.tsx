import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { NO_PAN_CLASS, useMapImageRect } from '@/components/maps/map-viewport';
import {
  arrowKeyDelta,
  normalizePointInRect,
  nudgePoint,
  pointsAreEqual,
  toPercentPosition,
  type NormalizedPoint,
} from '@/lib/map-coordinates';
import type { ScenePegProjection } from '@/lib/map-workspace-projection';

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

export function pegTargetName(peg: ScenePegProjection): string {
  return peg.kind === 'lore' ? peg.target.title : peg.target.name;
}

export function ScenePegButton({
  peg,
  selected,
  onSelect,
  onMove,
}: {
  peg: ScenePegProjection;
  selected: boolean;
  onSelect: () => void;
  onMove: (point: NormalizedPoint) => Promise<void>;
}) {
  const readImageRect = useMapImageRect();
  const loaderPoint = { x: peg.x, y: peg.y };
  const [dragPoint, setDragPoint] = useState<NormalizedPoint | null>(null);
  const draggingRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  // Revalidation is the source of truth: once the loader agrees, drop the local override.
  useEffect(() => {
    if (!draggingRef.current) {
      setDragPoint(null);
    }
  }, [peg.x, peg.y]);

  const position = dragPoint ?? loaderPoint;

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
    try {
      await onMove(next);
    } finally {
      // A failed move leaves the loader position in place, so clearing restores it visibly.
      draggingRef.current = false;
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
