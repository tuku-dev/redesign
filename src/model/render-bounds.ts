import { bounds } from './geometry.ts';
import { visualBox } from './rotation.ts';
import { isHidden } from './layer-state.ts';
import type { Box, DesignDocument, DesignNode } from './types.ts';
export function clippedVisualBox(doc: DesignDocument, node: DesignNode): Box | null {
  if (isHidden(doc, node)) return null;
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  let box: Box | null = visualBox(node),
    parent = node.parentId ? byId.get(node.parentId) : undefined;
  while (parent && box) {
    if (parent.type === 'frame' && parent.clipContent) {
      const clip = visualBox(parent),
        x = Math.max(box.x, clip.x),
        y = Math.max(box.y, clip.y),
        right = Math.min(box.x + box.width, clip.x + clip.width),
        bottom = Math.min(box.y + box.height, clip.y + clip.height);
      box = right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
    }
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return box;
}
export function documentVisualBounds(doc: DesignDocument): Box | null {
  return bounds(
    doc.nodes.flatMap((node) => {
      if (node.type === 'group') return [];
      const box = clippedVisualBox(doc, node);
      return box ? [box] : [];
    }),
  );
}
