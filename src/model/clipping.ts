import { insideMask, maskSource } from './masks.ts';
import type { DesignNode } from './types.ts';
import { center, transformNodePoint, pointInNode } from './rotation.ts';
import type { DesignDocument, Point } from './types.ts';
export function withinClips(doc: DesignDocument, node: DesignNode, point: Point): boolean {
  if (maskSource(doc, node)) return false;
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  if (node.maskId) {
    const mask = byId.get(node.maskId);
    if (!mask || !insideMask(mask, point)) return false;
  }
  let p = node.parentId ? byId.get(node.parentId) : undefined;
  while (p) {
    if (p.maskId) {
      const mask = byId.get(p.maskId);
      if (!mask || !insideMask(mask, point)) return false;
    }
    if (p.type === 'frame' && p.clipContent && !pointInNode(point, p)) return false;
    p = p.parentId ? byId.get(p.parentId) : undefined;
  }
  return true;
}
export function orientedResizeBox(
  node: DesignNode,
  local: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const c = transformNodePoint(center(local), node);
  return { ...local, x: c.x - local.width / 2, y: c.y - local.height / 2 };
}
