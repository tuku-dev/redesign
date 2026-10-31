import { corners, localPoint, transformNodePoint } from './rotation.ts';
import { hierarchyRows } from './hierarchy.ts';
import type { DesignDocument } from './types.ts';
export function updateGroupBounds(doc: DesignDocument): void {
  for (const { node } of hierarchyRows(doc).reverse())
    if (node.type === 'group') {
      const children = doc.nodes.filter((n) => n.parentId === node.id);
      if (!children.length) continue;
      const points = children.flatMap((n) => corners(n).map((p) => localPoint(p, node)));
      const x = Math.min(...points.map((p) => p.x)),
        y = Math.min(...points.map((p) => p.y)),
        width = Math.max(...points.map((p) => p.x)) - x,
        height = Math.max(...points.map((p) => p.y)) - y;
      const c = transformNodePoint({ x: x + width / 2, y: y + height / 2 }, node);
      Object.assign(node, { x: c.x - width / 2, y: c.y - height / 2, width, height });
    }
}
