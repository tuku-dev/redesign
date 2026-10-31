import type { DesignDocument, DesignNode } from './types.ts';
import type { Workspace } from './features.ts';
export function ensureWorkspace(doc: DesignDocument): Workspace {
  return (doc.workspace ??= {
    activePageId: 'page-1',
    pages: [{ id: 'page-1', name: 'Page 1', nodes: [] }],
    rulers: false,
    guidesVisible: true,
    guides: [],
  });
}
export function allNodes(doc: DesignDocument): DesignNode[] {
  return [...doc.nodes, ...(doc.workspace?.pages.flatMap((p) => p.nodes) ?? [])];
}
