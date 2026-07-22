import { describe, expect, it } from 'vitest';
import {
  arrowKeyDelta,
  clampNormalized,
  nudgePoint,
  normalizePointInRect,
  PEG_NUDGE_STEP,
  PEG_NUDGE_STEP_COARSE,
  pointsAreEqual,
  toPercentPosition,
  type RenderedRect,
} from '../map-coordinates.js';

describe('clampNormalized', () => {
  it.each([
    ['a value below zero', -0.5, 0],
    ['a value above one', 1.5, 1],
    ['exactly zero', 0, 0],
    ['exactly one', 1, 1],
    ['a mid-range value', 0.42, 0.42],
    ['NaN', Number.NaN, 0],
    ['positive infinity', Number.POSITIVE_INFINITY, 0],
    ['negative infinity', Number.NEGATIVE_INFINITY, 0],
  ])('clamps %s to %s', (_label, input, expected) => {
    expect(clampNormalized(input)).toBe(expected);
  });
});

describe('normalizePointInRect', () => {
  const rect: RenderedRect = { left: 40, top: 60, width: 300, height: 200 };

  it('maps a click at the rect center to (0.5, 0.5)', () => {
    expect(normalizePointInRect(190, 160, rect)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('maps a click at the top-left corner to (0, 0)', () => {
    expect(normalizePointInRect(40, 60, rect)).toEqual({ x: 0, y: 0 });
  });

  it('clamps a click outside the rect onto its nearest edge', () => {
    expect(normalizePointInRect(1000, 10, rect)).toEqual({ x: 1, y: 0 });
  });

  it.each([
    ['zero width', { left: 0, top: 0, width: 0, height: 200 }],
    ['zero height', { left: 0, top: 0, width: 300, height: 0 }],
    ['negative width', { left: 0, top: 0, width: -10, height: 200 }],
  ])('returns the origin when the rect has %s', (_label, badRect) => {
    expect(normalizePointInRect(500, 500, badRect)).toEqual({ x: 0, y: 0 });
  });

  it('produces the same normalized point for the same click at a zoomed and panned camera', () => {
    const zoomed: RenderedRect = { left: -400, top: -240, width: 1200, height: 800 };
    expect(normalizePointInRect(200, 160, zoomed)).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('toPercentPosition', () => {
  it('converts a normalized point into CSS percentage strings', () => {
    expect(toPercentPosition({ x: 0.25, y: 0.75 })).toEqual({ left: '25%', top: '75%' });
  });
});

describe('nudgePoint', () => {
  it('adds the delta and clamps the result', () => {
    expect(nudgePoint({ x: 0.5, y: 0.5 }, 0.1, -0.1)).toEqual({ x: 0.6, y: 0.4 });
  });

  it('stops at the edge instead of going out of range', () => {
    expect(nudgePoint({ x: 0.95, y: 0.05 }, 0.5, -0.5)).toEqual({ x: 1, y: 0 });
  });
});

describe('arrowKeyDelta', () => {
  it.each([
    ['ArrowLeft', false, { deltaX: -PEG_NUDGE_STEP, deltaY: 0 }],
    ['ArrowRight', false, { deltaX: PEG_NUDGE_STEP, deltaY: 0 }],
    ['ArrowUp', false, { deltaX: 0, deltaY: -PEG_NUDGE_STEP }],
    ['ArrowDown', false, { deltaX: 0, deltaY: PEG_NUDGE_STEP }],
    ['ArrowLeft', true, { deltaX: -PEG_NUDGE_STEP_COARSE, deltaY: 0 }],
    ['ArrowRight', true, { deltaX: PEG_NUDGE_STEP_COARSE, deltaY: 0 }],
    ['ArrowUp', true, { deltaX: 0, deltaY: -PEG_NUDGE_STEP_COARSE }],
    ['ArrowDown', true, { deltaX: 0, deltaY: PEG_NUDGE_STEP_COARSE }],
  ] as const)('resolves %s (coarse=%s) to %o', (key, coarse, expected) => {
    expect(arrowKeyDelta(key, coarse)).toEqual(expected);
  });

  it('returns null for a key that is not an arrow key', () => {
    expect(arrowKeyDelta('Enter', false)).toBeNull();
  });

  it('takes the coarse step only when shift is held', () => {
    const fine = arrowKeyDelta('ArrowRight', false);
    const coarse = arrowKeyDelta('ArrowRight', true);
    expect(coarse?.deltaX).toBeGreaterThan(fine?.deltaX ?? 0);
  });

  it('repeated fine nudges match the documented keyboard scenario', () => {
    let point = { x: 0.5, y: 0.5 };
    for (let i = 0; i < 3; i += 1) {
      const delta = arrowKeyDelta('ArrowRight', false);
      point = nudgePoint(point, delta?.deltaX ?? 0, delta?.deltaY ?? 0);
    }
    expect(point.x).toBeCloseTo(0.53, 5);

    for (let i = 0; i < 12; i += 1) {
      const delta = arrowKeyDelta('ArrowUp', true);
      point = nudgePoint(point, delta?.deltaX ?? 0, delta?.deltaY ?? 0);
    }
    expect(point.y).toBeCloseTo(0, 5);
  });
});

describe('pointsAreEqual', () => {
  it('is true for points with identical coordinates', () => {
    expect(pointsAreEqual({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBe(true);
  });

  it.each([
    ['x differs', { x: 0.5, y: 0.5 }, { x: 0.51, y: 0.5 }],
    ['y differs', { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.51 }],
  ])('is false when %s', (_label, left, right) => {
    expect(pointsAreEqual(left, right)).toBe(false);
  });
});
