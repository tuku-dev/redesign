import type { Box, DesignDocument, DesignNode, Point } from './types.ts';
export function selectedNodes(doc: DesignDocument, ids: ReadonlySet<string>): DesignNode[] {
  return doc.nodes.filter((n) => ids.has(n.id));
}
export function boxBetween(a: Point, b: Point): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}
export function marqueeIds(nodes: readonly DesignNode[], box: Box): string[] {
  return nodes
    .filter(
      (n) =>
        n.x <= box.x + box.width &&
        n.x + n.width >= box.x &&
        n.y <= box.y + box.height &&
        n.y + n.height >= box.y,
    )
    .map((n) => n.id);
}
export function toggleId(ids: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(ids);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
