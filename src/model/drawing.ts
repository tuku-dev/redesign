import type { Box, Point } from './types.ts';
import { boxBetween } from './selection.ts';
export function drawingBox(start: Point, end: Point, perfect = false): Box {
  if (!perfect) {
    const box = boxBetween(start, end);
    return { ...box, width: Math.max(1, box.width), height: Math.max(1, box.height) };
  }
  const side = Math.max(1, Math.abs(end.x - start.x), Math.abs(end.y - start.y));
  return {
    x: end.x < start.x ? start.x - side : start.x,
    y: end.y < start.y ? start.y - side : start.y,
    width: side,
    height: side,
  };
}
