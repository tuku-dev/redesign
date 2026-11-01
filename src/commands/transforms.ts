import { center, rotatePoint } from '../model/rotation.ts';
import { clone } from '../model/types.ts';
import type { DesignDocument, DesignNode, Box, ResizeHandle, Point } from '../model/types.ts';
export function translateNodes(
  doc: DesignDocument,
  originals: readonly DesignNode[],
  dx: number,
  dy: number,
): void {
  const starts = new Map(originals.map((n) => [n.id, n]));
  doc.nodes = doc.nodes.map((n) => {
    const start = starts.get(n.id);
    return start ? { ...n, x: start.x + dx, y: start.y + dy } : n;
  });
}
export function resizeBox(
  start: Box,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  { aspect = false, center = false, minWidth = 1, minHeight = 1 } = {},
): Box {
  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  const multiplier = center ? 2 : 1;
  let width = sx ? Math.max(minWidth, start.width + sx * dx * multiplier) : start.width;
  let height = sy ? Math.max(minHeight, start.height + sy * dy * multiplier) : start.height;
  if (aspect) {
    let factor =
      sx && sy
        ? Math.abs(width / start.width - 1) >= Math.abs(height / start.height - 1)
          ? width / start.width
          : height / start.height
        : sx
          ? width / start.width
          : height / start.height;
    factor = Math.max(factor, minWidth / start.width, minHeight / start.height);
    width = start.width * factor;
    height = start.height * factor;
  }
  const x =
    center || (!sx && aspect)
      ? start.x + (start.width - width) / 2
      : sx < 0
        ? start.x + start.width - width
        : start.x;
  const y =
    center || (!sy && aspect)
      ? start.y + (start.height - height) / 2
      : sy < 0
        ? start.y + start.height - height
        : start.y;
  return { x, y, width, height };
}
export function resizeNodes(
  doc: DesignDocument,
  originals: readonly DesignNode[],
  from: Box,
  to: Box,
): void {
  const starts = new Map(originals.map((n) => [n.id, n]));
  const sx = to.width / from.width,
    sy = to.height / from.height;
  doc.nodes = doc.nodes.map((n) => {
    const old = starts.get(n.id);
    return old
      ? {
          ...n,
          x: to.x + (old.x - from.x) * sx,
          y: to.y + (old.y - from.y) * sy,
          width: old.width * sx,
          height: old.height * sy,
        }
      : n;
  });
}
export function cloneNodes(nodes: readonly DesignNode[], dx = 20, dy = 20): DesignNode[] {
  const ids = new Map(nodes.map((n) => [n.id, crypto.randomUUID()]));
  return nodes.map((n) => ({
    ...clone(n),
    id: ids.get(n.id)!,
    ...(n.maskId ? { maskId: ids.get(n.maskId) ?? n.maskId } : {}),
    parentId: n.parentId ? (ids.get(n.parentId) ?? n.parentId) : null,
    ...(n.component?.sourceId
      ? {
          component: {
            ...n.component,
            sourceId: ids.get(n.component.sourceId) ?? n.component.sourceId,
          },
        }
      : {}),
    ...(n.instanceSource ? { instanceSource: ids.get(n.instanceSource) ?? n.instanceSource } : {}),
    ...(n.prototype
      ? {
          prototype: {
            ...n.prototype,
            targetId: ids.get(n.prototype.targetId) ?? n.prototype.targetId,
          },
        }
      : {}),
    x: n.x + dx,
    y: n.y + dy,
  }));
}

export function resizeOrientedNodes(
  doc: DesignDocument,
  originals: readonly DesignNode[],
  from: Box,
  to: Box,
  pivot: Point,
  angle: number,
): void {
  const starts = new Map(originals.map((n) => [n.id, n])),
    sx = to.width / from.width,
    sy = to.height / from.height;
  doc.nodes = doc.nodes.map((n) => {
    const old = starts.get(n.id);
    if (!old) return n;
    const p = rotatePoint(center(old), pivot, -angle),
      width = old.width * sx,
      height = old.height * sy;
    const next = rotatePoint(
      { x: to.x + (p.x - from.x) * sx, y: to.y + (p.y - from.y) * sy },
      pivot,
      angle,
    );
    return { ...n, x: next.x - width / 2, y: next.y - height / 2, width, height };
  });
}
