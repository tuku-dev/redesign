import type { Box, DesignNode, Point } from './types.ts';
export function center(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
export function rotatePoint(point: Point, pivot: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180,
    c = Math.cos(radians),
    s = Math.sin(radians),
    dx = point.x - pivot.x,
    dy = point.y - pivot.y;
  return { x: pivot.x + dx * c - dy * s, y: pivot.y + dx * s + dy * c };
}
export function normalizeAngle(angle: number): number {
  return ((((angle + 180) % 360) + 360) % 360) - 180;
}
export function angleAt(point: Point, pivot: Point): number {
  return (Math.atan2(point.y - pivot.y, point.x - pivot.x) * 180) / Math.PI;
}
export function corners(node: Box & { rotation?: number }): Point[] {
  const pivot = center(node);
  return [
    { x: node.x, y: node.y },
    { x: node.x + node.width, y: node.y },
    { x: node.x + node.width, y: node.y + node.height },
    { x: node.x, y: node.y + node.height },
  ].map((p) => rotatePoint(p, pivot, node.rotation ?? 0));
}
export function visualBox(node: Box & { rotation?: number }): Box {
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
  return rotatePoint(point, center(node), -node.rotation);
}
export function pointInNode(point: Point, node: Box & { rotation?: number }): boolean {
  const p = rotatePoint(point, center(node), -(node.rotation ?? 0));
  return (
    p.x >= node.x && p.y >= node.y && p.x <= node.x + node.width && p.y <= node.y + node.height
  );
}
