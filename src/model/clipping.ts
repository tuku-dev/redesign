import type { DesignNode } from './types.ts';
import { center, rotatePoint, pointInNode } from './rotation.ts';
import type { DesignDocument, Point } from './types.ts';
export function withinClips(doc: DesignDocument, node: DesignNode, point: Point): boolean {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  let p = node.parentId ? byId.get(node.parentId) : undefined;
  while (p) {
    if (p.type === 'frame' && p.clipContent && !pointInNode(point, p)) return false;
    p = p.parentId ? byId.get(p.parentId) : undefined;
  }
  return true;
}
export function orientedResizeBox(
  node: DesignNode,
  local: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const c = rotatePoint(center(local), center(node), node.rotation);
  return { ...local, x: c.x - local.width / 2, y: c.y - local.height / 2 };
}
