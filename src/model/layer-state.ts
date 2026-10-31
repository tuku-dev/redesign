import type { DesignDocument, DesignNode } from './types.ts';
export function inheritedFlag(
  doc: DesignDocument,
  node: DesignNode,
  key: 'locked' | 'hidden',
): boolean {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  let current: DesignNode | undefined = node;
  while (current) {
    if (current[key]) return true;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}
export const isLocked = (doc: DesignDocument, node: DesignNode): boolean =>
  inheritedFlag(doc, node, 'locked');
export const isHidden = (doc: DesignDocument, node: DesignNode): boolean =>
  inheritedFlag(doc, node, 'hidden');
export function editableNodes(doc: DesignDocument, ids: ReadonlySet<string>): DesignNode[] {
  return doc.nodes.filter((n) => ids.has(n.id) && !isLocked(doc, n));
}
export function groupedTarget(doc: DesignDocument, id: string, deep = false): string {
  if (deep) return id;
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  let target = id;
  for (let p = byId.get(byId.get(id)?.parentId ?? ''); p?.type === 'group';) {
    target = p.id;
    p = byId.get(p.parentId ?? '');
  }
  return target;
}
