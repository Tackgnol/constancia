/**
 * Peg coordinates are a share of the rendered map image, never pixels. Storing them this way is
 * what lets a peg survive zoom, pan, a resize, and a map replacement.
 */

export interface NormalizedPoint {
  x: number;
  y: number;
}

/** The parts of a DOMRect this module needs, so the helpers stay testable without a browser. */
export interface RenderedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const PEG_NUDGE_STEP = 0.01;
export const PEG_NUDGE_STEP_COARSE = 0.05;

export function clampNormalized(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

/**
 * Converts a pointer position into normalized image coordinates. The rect comes from the
 * transformed image's bounding box, which already accounts for the current pan and zoom, so the
 * same click maps to the same coordinate at any camera position.
 */
export function normalizePointInRect(
  clientX: number,
  clientY: number,
  rect: RenderedRect,
): NormalizedPoint {
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: clampNormalized((clientX - rect.left) / rect.width),
    y: clampNormalized((clientY - rect.top) / rect.height),
  };
}

export function toPercentPosition(point: NormalizedPoint): { left: string; top: string } {
  return { left: `${point.x * 100}%`, top: `${point.y * 100}%` };
}

export function nudgePoint(
  point: NormalizedPoint,
  deltaX: number,
  deltaY: number,
): NormalizedPoint {
  return {
    x: clampNormalized(point.x + deltaX),
    y: clampNormalized(point.y + deltaY),
  };
}

/**
 * Arrow keys move a selected peg so placement never requires precise pointer control. Shift takes
 * the coarser step.
 */
export function arrowKeyDelta(
  key: string,
  coarse: boolean,
): { deltaX: number; deltaY: number } | null {
  const step = coarse ? PEG_NUDGE_STEP_COARSE : PEG_NUDGE_STEP;

  switch (key) {
    case 'ArrowLeft':
      return { deltaX: -step, deltaY: 0 };
    case 'ArrowRight':
      return { deltaX: step, deltaY: 0 };
    case 'ArrowUp':
      return { deltaX: 0, deltaY: -step };
    case 'ArrowDown':
      return { deltaX: 0, deltaY: step };
    default:
      return null;
  }
}

export function pointsAreEqual(left: NormalizedPoint, right: NormalizedPoint): boolean {
  return left.x === right.x && left.y === right.y;
}
