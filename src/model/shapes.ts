import type { DesignNode, Point } from './types.ts';
import { vectorFromPoints } from './vector.ts';

export type ShapeKind = 'line' | 'polygon' | 'star';

export const MIN_SIDES = 3;
export const MAX_SIDES = 60;
export const RECTANGLE_SIDES = 4;

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

/**
 * Turns a node being drawn into a regular polygon that fills its box, or back into a
 * rectangle when the side count is 4. Vector points are box-relative, so later resizing keeps working.
 */
export function applyPolygonSides(node: DesignNode, sides: number): void {
  if (sides === RECTANGLE_SIDES) {
    node.type = 'rectangle';
    node.name = 'Rectangle';
    delete node.vector;
    return;
  }
  node.type = 'path';
  node.name = 'Polygon';
  node.vector = vectorFromPoints([polygonPoints({ x: 0, y: 0 }, 1, sides)]).vector;
}
