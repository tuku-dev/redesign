import { editableNodes } from '../model/layer-state.ts';
import { selectionRoots, descendants } from '../model/hierarchy.ts';
import { bounds } from '../model/geometry.ts';
import { clone } from '../model/types.ts';
import type { DesignDocument, DesignNode, Alignment, Axis } from '../model/types.ts';
import { translateNodes } from './transforms.ts';
export function alignNodes(doc: DesignDocument, ids: ReadonlySet<string>, mode: Alignment): void {
  const nodes = selectionRoots(doc, new Set(editableNodes(doc, ids).map((n) => n.id))),
    box = bounds(nodes);
  if (nodes.length < 2 || !box) return;
  const positions: Record<Alignment, (n: DesignNode) => { x: number; y: number }> = {
    left: (n) => ({ x: box.x, y: n.y }),
    center: (n) => ({ x: box.x + (box.width - n.width) / 2, y: n.y }),
    right: (n) => ({ x: box.x + box.width - n.width, y: n.y }),
    top: (n) => ({ x: n.x, y: box.y }),
    middle: (n) => ({ x: n.x, y: box.y + (box.height - n.height) / 2 }),
    bottom: (n) => ({ x: n.x, y: box.y + box.height - n.height }),
  };
  for (const n of nodes) {
    const next = positions[mode](n);
    translateNodes(doc, clone(descendants(doc, new Set([n.id]))), next.x - n.x, next.y - n.y);
  }
}
export function distributeNodes(doc: DesignDocument, ids: ReadonlySet<string>, axis: Axis): void {
  const size = axis === 'x' ? 'width' : 'height',
    nodes = selectionRoots(doc, new Set(editableNodes(doc, ids).map((n) => n.id))).sort(
      (a, b) => a[axis] - b[axis],
    );
  if (nodes.length < 3) return;
  const first = nodes[0],
    last = nodes.at(-1);
  if (!last) return;
  const span = last[axis] + last[size] - first[axis],
    gap = (span - nodes.reduce((sum, n) => sum + n[size], 0)) / (nodes.length - 1);
  let cursor = first[axis] + first[size] + gap;
  for (let i = 1; i < nodes.length - 1; i++) {
    const n = nodes[i],
      delta = cursor - n[axis];
    translateNodes(
      doc,
      clone(descendants(doc, new Set([n.id]))),
      axis === 'x' ? delta : 0,
      axis === 'y' ? delta : 0,
    );
    cursor += n[size] + gap;
  }
}
export function distributeAlignedNodes(
  doc: DesignDocument,
  ids: ReadonlySet<string>,
  mode: Alignment,
): void {
  const horizontal = mode === 'left' || mode === 'center' || mode === 'right',
    axis = horizontal ? 'x' : 'y',
    size = horizontal ? 'width' : 'height',
    offset =
      mode === 'center' || mode === 'middle' ? 0.5 : mode === 'right' || mode === 'bottom' ? 1 : 0,
    coordinate = (node: DesignNode) => node[axis] + node[size] * offset,
    nodes = selectionRoots(doc, new Set(editableNodes(doc, ids).map((n) => n.id))).sort(
      (a, b) => coordinate(a) - coordinate(b),
    );
  if (nodes.length < 3) return;
  const first = nodes[0],
    last = nodes.at(-1);
  if (!first || !last) return;
  const start = coordinate(first),
    step = (coordinate(last) - start) / (nodes.length - 1);
  for (let index = 1; index < nodes.length - 1; index++) {
    const node = nodes[index];
    if (!node) continue;
    const delta = start + step * index - coordinate(node);
    translateNodes(
      doc,
      clone(descendants(doc, new Set([node.id]))),
      horizontal ? delta : 0,
      horizontal ? 0 : delta,
    );
  }
}
