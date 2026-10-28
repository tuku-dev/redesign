import { corners, center, rotatePoint } from './rotation.ts';
import { hierarchyRows } from './hierarchy.ts';
import type { DesignDocument } from './types.ts';
export function updateGroupBounds(doc: DesignDocument): void {
  for (const { node } of hierarchyRows(doc).reverse())
    if (node.type === 'group') {
      const children = doc.nodes.filter((n) => n.parentId === node.id);
      if (!children.length) continue;
      const pivot = center(node),
        points = children.flatMap((n) =>
          corners(n).map((p) => rotatePoint(p, pivot, -node.rotation)),
        );
      const x = Math.min(...points.map((p) => p.x)),
        y = Math.min(...points.map((p) => p.y)),
        width = Math.max(...points.map((p) => p.x)) - x,
        height = Math.max(...points.map((p) => p.y)) - y;
      const c = rotatePoint({ x: x + width / 2, y: y + height / 2 }, pivot, node.rotation);
      Object.assign(node, { x: c.x - width / 2, y: c.y - height / 2, width, height });
    }
}
