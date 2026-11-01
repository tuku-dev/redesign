import { pointInNode, corners } from './rotation.ts';
import { isLocked, isHidden } from './layer-state.ts';
import type { Box, DesignDocument, DesignNode } from './types.ts';

// Coordinates remain in document space. parentId owns containment and subtree operations.
export function descendants(doc: DesignDocument, ids: ReadonlySet<string>): DesignNode[] {
  const included = new Set(ids);
  const children = new Map<string, DesignNode[]>();
  for (const n of doc.nodes)
    if (n.parentId) {
      const list = children.get(n.parentId) ?? [];
      list.push(n);
      children.set(n.parentId, list);
    }
  const queue = [...ids];
  for (let i = 0; i < queue.length; i++)
    for (const n of children.get(queue[i]) ?? [])
      if (!included.has(n.id)) {
        included.add(n.id);
        queue.push(n.id);
      }
  return doc.nodes.filter((n) => included.has(n.id));
}
export function selectionRoots(doc: DesignDocument, ids: ReadonlySet<string>): DesignNode[] {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  return doc.nodes.filter((n) => {
    if (!ids.has(n.id)) return false;
    let parent = n.parentId;
    while (parent) {
      if (ids.has(parent)) return false;
      parent = byId.get(parent)?.parentId ?? null;
    }
    return true;
  });
}
export function hierarchyRows(doc: DesignDocument): { node: DesignNode; depth: number }[] {
  const children = new Map<string | null, DesignNode[]>();
  for (const n of doc.nodes) {
    const list = children.get(n.parentId) ?? [];
    list.push(n);
    children.set(n.parentId, list);
  }
  const rows: { node: DesignNode; depth: number }[] = [];
  const visit = (parent: string | null, depth: number) => {
    for (const node of children.get(parent) ?? []) {
      rows.push({ node, depth });
      visit(node.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}
export function containsBox(
  frame: Box & { rotation?: number },
  box: Box & { rotation?: number },
): boolean {
  if (frame.rotation || box.rotation) return corners(box).every((p) => pointInNode(p, frame));
  return (
    box.x >= frame.x &&
    box.y >= frame.y &&
    box.x + box.width <= frame.x + frame.width &&
    box.y + box.height <= frame.y + frame.height
  );
}
export function containingFrame(
  doc: DesignDocument,
  node: DesignNode,
  excluded: ReadonlySet<string> = new Set(),
  fully = false,
): DesignNode | undefined {
  const cx = node.x + node.width / 2,
    cy = node.y + node.height / 2;
  return hierarchyRows(doc)
    .map((row) => row.node)
    .reverse()
    .find(
      (f) =>
        f.type === 'frame' &&
        !isLocked(doc, f) &&
        !isHidden(doc, f) &&
        f.id !== node.id &&
        !excluded.has(f.id) &&
        (node.type !== 'frame' || (f.width >= node.width && f.height >= node.height)) &&
        (fully ? containsBox(f, node) : pointInNode({ x: cx, y: cy }, f)),
    );
}
export function reparentSelection(doc: DesignDocument, ids: ReadonlySet<string>): void {
  const roots = selectionRoots(doc, ids),
    excluded = new Set(descendants(doc, new Set(roots.map((n) => n.id))).map((n) => n.id));
  for (const n of roots) n.parentId = containingFrame(doc, n, excluded)?.id ?? null;
}
export function adoptEnclosed(doc: DesignDocument, frame: DesignNode): void {
  if (frame.type !== 'frame') return;
  for (const n of doc.nodes)
    if (
      n.id !== frame.id &&
      n.parentId === frame.parentId &&
      !isLocked(doc, n) &&
      !isHidden(doc, n) &&
      containsBox(frame, n)
    )
      n.parentId = frame.id;
}
export function assertHierarchy(nodes: readonly DesignNode[]): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    if (n.maskId) {
      const mask = byId.get(n.maskId);
      if (
        !mask ||
        mask.parentId !== n.id ||
        !['rectangle', 'ellipse', 'path'].includes(mask.type) ||
        (mask.type === 'path' && !mask.vector?.closed)
      )
        throw Error('Invalid outline mask reference.');
    }
    const visited = new Set([n.id]);
    let parent = n.parentId;
    while (parent !== null) {
      const p = byId.get(parent);
      if (
        !p ||
        (p.type !== 'frame' && p.type !== 'group') ||
        visited.has(parent) ||
        visited.size > 256
      )
        throw new Error('Invalid frame hierarchy.');
      visited.add(parent);
      parent = p.parentId;
    }
  }
}
export function detachedCopy(nodes: readonly DesignNode[]): DesignNode[] {
  const ids = new Set(nodes.map((n) => n.id));
  return structuredClone(nodes).map((n) => ({
    ...n,
    parentId: n.parentId && ids.has(n.parentId) ? n.parentId : null,
  }));
}
