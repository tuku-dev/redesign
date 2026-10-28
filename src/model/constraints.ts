import type { Box, ConstraintMode, DesignDocument, DesignNode } from './types.ts';
import { center, rotatePoint } from './rotation.ts';
export function constrainAxis(
  position: number,
  size: number,
  oldSize: number,
  newSize: number,
  mode: ConstraintMode,
): { position: number; size: number } {
  const delta = newSize - oldSize;
  if (mode === 'end') return { position: position + delta, size };
  if (mode === 'center') return { position: position + delta / 2, size };
  if (mode === 'stretch') return { position, size: Math.max(1, size + delta) };
  if (mode === 'scale')
    return {
      position: (position * newSize) / oldSize,
      size: Math.max(1, (size * newSize) / oldSize),
    };
  return { position, size };
}
// Document-space geometry is projected into the frame's axes for each constraint solve.
export function resizeFrame(
  doc: DesignDocument,
  before: DesignDocument,
  frameId: string,
  box: Box,
): void {
  const originals = new Map(before.nodes.map((n) => [n.id, n])),
    targets = new Map(doc.nodes.map((n) => [n.id, n]));
  const children = new Map<string, DesignNode[]>();
  for (const n of before.nodes)
    if (n.parentId) {
      const list = children.get(n.parentId) ?? [];
      list.push(n);
      children.set(n.parentId, list);
    }
  function visit(id: string, next: Box): void {
    const old = originals.get(id),
      node = targets.get(id);
    if (!old || !node) return;
    Object.assign(node, next);
    for (const child of children.get(id) ?? []) {
      const c = rotatePoint(center(child), center(old), -old.rotation),
        px = c.x - old.x - child.width / 2,
        py = c.y - old.y - child.height / 2;
      const horizontal =
        node.type === 'group'
          ? constrainAxis(px, child.width, old.width, node.width, 'scale')
          : constrainAxis(px, child.width, old.width, node.width, child.constraintX);
      const vertical =
        node.type === 'group'
          ? constrainAxis(py, child.height, old.height, node.height, 'scale')
          : constrainAxis(py, child.height, old.height, node.height, child.constraintY);
      const world = rotatePoint(
        {
          x: node.x + horizontal.position + horizontal.size / 2,
          y: node.y + vertical.position + vertical.size / 2,
        },
        center(node),
        node.rotation,
      );
      visit(child.id, {
        x: world.x - horizontal.size / 2,
        y: world.y - vertical.size / 2,
        width: horizontal.size,
        height: vertical.size,
      });
    }
  }
  visit(frameId, box);
}
