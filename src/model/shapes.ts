import type { DesignNode, Point } from './types.ts';
import { defaultAppearance } from './features.ts';
import { vectorFromPoints } from './vector.ts';

export type ShapeKind = 'line' | 'polygon' | 'star';

export const MIN_SIDES = 3;
export const MAX_SIDES = 60;
export const RECTANGLE_SIDES = 4;
export const DEFAULT_STAR_POINTS = 5;
export const DEFAULT_POLYGON_SIDES = 3;
/** Mid gray so a new line stays visible on both the light and dark canvas. */
export const LINE_STROKE = '#8c8c8c';

/** What the rectangle tool draws; chosen from the toolbar drop-up. */
export type DrawShape = 'rectangle' | 'line' | 'arrow' | 'polygon' | 'star';
export const DRAW_SHAPES: readonly DrawShape[] = ['rectangle', 'line', 'arrow', 'polygon', 'star'];

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
export function applyPolygonSides(node: DesignNode, sides: number, keepPath = false): void {
  if (sides === RECTANGLE_SIDES && !keepPath) {
    node.type = 'rectangle';
    node.name = 'Rectangle';
    delete node.vector;
    return;
  }
  node.type = 'path';
  node.name = 'Polygon';
  node.vector = vectorFromPoints([polygonPoints({ x: 0, y: 0 }, 1, sides)]).vector;
}
export function applyStarPoints(node: DesignNode, points: number): void {
  node.type = 'path';
  node.name = 'Star';
  node.vector = vectorFromPoints([starPoints({ x: 0, y: 0 }, 1, points)]).vector;
}

/** Snaps the direction from start to end to the nearest 45 degrees. */
export function snapLineAngle(start: Point, end: Point): Point {
  const dx = end.x - start.x,
    dy = end.y - start.y,
    length = Math.hypot(dx, dy),
    angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: start.x + length * Math.cos(angle), y: start.y + length * Math.sin(angle) };
}

/** Makes the node an open two-point path from start to end; a zero-length drag stays one pixel long. */
export function applyLine(node: DesignNode, start: Point, end: Point): void {
  const to = start.x === end.x && start.y === end.y ? { x: end.x + 1, y: end.y } : end;
  Object.assign(node, vectorFromPoints([[start, to]], false));
  node.type = 'path';
  node.name = 'Line';
  node.appearance ??= { ...defaultAppearance(), stroke: LINE_STROKE, strokeWidth: 2 };
}

/** Makes the node a line with an open chevron arrowhead at end; the head shrinks on short lines. */
export function applyArrow(node: DesignNode, start: Point, end: Point): void {
  const to = start.x === end.x && start.y === end.y ? { x: end.x + 1, y: end.y } : end;
  const length = Math.hypot(to.x - start.x, to.y - start.y),
    angle = Math.atan2(to.y - start.y, to.x - start.x),
    head = Math.min(16, length * 0.4),
    wing = (offset: number): Point => ({
      x: to.x - head * Math.cos(angle + offset),
      y: to.y - head * Math.sin(angle + offset),
    });
  Object.assign(
    node,
    vectorFromPoints(
      [
        [start, to],
        [wing(-Math.PI / 6), to, wing(Math.PI / 6)],
      ],
      false,
    ),
  );
  node.type = 'path';
  node.name = 'Arrow';
  node.appearance ??= { ...defaultAppearance(), stroke: LINE_STROKE, strokeWidth: 2 };
}
