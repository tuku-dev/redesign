import type { Box, DesignNode, Point } from './types.ts';
export function center(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
export type TransformableBox = Box & {
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
};
export function rotatePoint(point: Point, pivot: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180,
    c = Math.cos(radians),
    s = Math.sin(radians),
    dx = point.x - pivot.x,
    dy = point.y - pivot.y;
  return { x: pivot.x + dx * c - dy * s, y: pivot.y + dx * s + dy * c };
}
export function transformNodePoint(point: Point, node: TransformableBox): Point {
  const pivot = center(node);
  return rotatePoint(
    {
      x: pivot.x + (point.x - pivot.x) * (node.flipX ? -1 : 1),
      y: pivot.y + (point.y - pivot.y) * (node.flipY ? -1 : 1),
    },
    pivot,
    node.rotation ?? 0,
  );
}
export function nodeTransform(node: TransformableBox): string | null {
  if (!node.rotation && !node.flipX && !node.flipY) return null;
  const pivot = center(node);
  return `translate(${pivot.x} ${pivot.y}) rotate(${node.rotation ?? 0}) scale(${node.flipX ? -1 : 1} ${node.flipY ? -1 : 1}) translate(${-pivot.x} ${-pivot.y})`;
}
export function normalizeAngle(angle: number): number {
  return ((((angle + 180) % 360) + 360) % 360) - 180;
}
export function angleAt(point: Point, pivot: Point): number {
  return (Math.atan2(point.y - pivot.y, point.x - pivot.x) * 180) / Math.PI;
}
export function corners(node: TransformableBox): Point[] {
  return [
    { x: node.x, y: node.y },
    { x: node.x + node.width, y: node.y },
    { x: node.x + node.width, y: node.y + node.height },
    { x: node.x, y: node.y + node.height },
  ].map((p) => transformNodePoint(p, node));
}
export function visualBox(node: TransformableBox): Box {
  const points = corners(node),
    x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...points.map((p) => p.x)) - x,
    height: Math.max(...points.map((p) => p.y)) - y,
  };
}
export function localPoint(point: Point, node: DesignNode): Point {
  const pivot = center(node),
    rotated = rotatePoint(point, pivot, -node.rotation);
  return {
    x: pivot.x + (rotated.x - pivot.x) * (node.flipX ? -1 : 1),
    y: pivot.y + (rotated.y - pivot.y) * (node.flipY ? -1 : 1),
  };
}
export function pointInNode(point: Point, node: TransformableBox): boolean {
  const pivot = center(node),
    rotated = rotatePoint(point, pivot, -(node.rotation ?? 0)),
    p = {
      x: pivot.x + (rotated.x - pivot.x) * (node.flipX ? -1 : 1),
      y: pivot.y + (rotated.y - pivot.y) * (node.flipY ? -1 : 1),
    };
  return (
    p.x >= node.x && p.y >= node.y && p.x <= node.x + node.width && p.y <= node.y + node.height
  );
}
