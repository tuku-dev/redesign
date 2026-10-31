import type { Point } from './types.ts';

export type ShapeKind = 'line' | 'polygon' | 'star';

const MIN_SIDES = 3;
const MAX_SIDES = 60;

function clampCount(value: number, min = MIN_SIDES): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(MAX_SIDES, Math.max(min, Math.round(value)));
}

/** Vertices of a regular polygon whose first vertex points up. */
export function polygonPoints(center: Point, radius: number, sides: number): Point[] {
  const count = clampCount(sides);
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  });
}

/** Alternating outer/inner vertices; innerRatio is the inner radius as a fraction of outer. */
export function starPoints(
  center: Point,
  radius: number,
  points: number,
  innerRatio = 0.5,
): Point[] {
  const count = clampCount(points);
  const ratio = Number.isFinite(innerRatio) ? Math.min(0.95, Math.max(0.05, innerRatio)) : 0.5;
  return Array.from({ length: count * 2 }, (_, i) => {
    const r = i % 2 === 0 ? radius : radius * ratio;
    const angle = -Math.PI / 2 + (i * Math.PI) / count;
    return { x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) };
  });
}

export function linePoints(center: Point, length: number): Point[] {
  const half = Math.max(1, length) / 2;
  return [
    { x: center.x - half, y: center.y },
    { x: center.x + half, y: center.y },
  ];
}
