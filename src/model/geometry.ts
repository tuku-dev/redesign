import type { Box, Point } from './types.ts';
export function bounds(nodes: readonly Box[]): Box | null {
  if (!nodes.length) return null;
  const x = Math.min(...nodes.map((n) => n.x)),
    y = Math.min(...nodes.map((n) => n.y));
  return {
    x,
    y,
    width: Math.max(...nodes.map((n) => n.x + n.width)) - x,
    height: Math.max(...nodes.map((n) => n.y + n.height)) - y,
  };
}
export function fitView(
  box: Box | null,
  width: number,
  height: number,
  padding = 64,
): { zoom: number; pan: Point } | null {
  if (!box || width <= 0 || height <= 0) return null;
  const zoom = Math.max(
    0.1,
    Math.min(
      8,
      Math.max(1, width - 2 * padding) / box.width,
      Math.max(1, height - 2 * padding) / box.height,
    ),
  );
  return {
    zoom,
    pan: {
      x: width / 2 - (box.x + box.width / 2) * zoom,
      y: height / 2 - (box.y + box.height / 2) * zoom,
    },
  };
}
