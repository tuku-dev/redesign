import type { DesignDocument, DesignNode } from './types.ts';
import { descendants } from './hierarchy.ts';
import { transformNodePoint } from './rotation.ts';
/** Translate whole subtrees, including nested frames, without changing local geometry. */
export function moveSubtree(doc: DesignDocument, node: DesignNode, x: number, y: number): void {
  const dx = x - node.x,
    dy = y - node.y;
  for (const child of descendants(doc, new Set([node.id]))) {
    child.x += dx;
    child.y += dy;
  }
}
/** Two passes resolve nested hug sizes before parents distribute fill space. */
export function applyAutoLayout(doc: DesignDocument): void {
  const children = new Map<string, DesignNode[]>();
  for (const n of doc.nodes)
    if (n.parentId && !n.hidden) {
      const list = children.get(n.parentId) ?? [];
      list.push(n);
      children.set(n.parentId, list);
    }
  function measure(n: DesignNode): void {
    const list = children.get(n.id) ?? [];
    list.forEach(measure);
    if (!n.layout) return;
    const l = n.layout,
      p = l.padding,
      h = l.direction === 'horizontal';
    const main =
      list.reduce((sum, c) => sum + (h ? c.width : c.height), 0) +
      Math.max(0, list.length - 1) * l.gap;
    const cross = Math.max(0, ...list.map((c) => (h ? c.height : c.width)));
    if (n.sizing?.width === 'hug') n.width = Math.max(1, (h ? main : cross) + p.left + p.right);
    if (n.sizing?.height === 'hug') n.height = Math.max(1, (h ? cross : main) + p.top + p.bottom);
  }
  function arrange(n: DesignNode): void {
    const list = children.get(n.id) ?? [];
    if (n.layout && list.length) {
      const l = n.layout,
        p = l.padding,
        h = l.direction === 'horizontal';
      const mainSize = Math.max(1, h ? n.width - p.left - p.right : n.height - p.top - p.bottom);
      const crossSize = Math.max(1, h ? n.height - p.top - p.bottom : n.width - p.left - p.right);
      const axis = h ? 'width' : 'height',
        cross = h ? 'height' : 'width';
      const fills = list.filter((c) => c.sizing?.[axis] === 'fill');
      const fixed = list
        .filter((c) => c.sizing?.[axis] !== 'fill')
        .reduce((sum, c) => sum + c[axis], 0);
      for (const c of fills)
        c[axis] = Math.max(1, (mainSize - fixed - l.gap * (list.length - 1)) / fills.length);
      const used = list.reduce((sum, c) => sum + c[axis], 0),
        free = Math.max(0, mainSize - used - l.gap * (list.length - 1));
      const gap =
        l.justify === 'space-between' && list.length > 1
          ? Math.max(l.gap, (mainSize - used) / (list.length - 1))
          : l.gap;
      let cursor =
        (h ? p.left : p.top) + (l.justify === 'center' ? free / 2 : l.justify === 'end' ? free : 0);
      for (const c of list) {
        if (c.sizing?.[cross] === 'fill') c[cross] = crossSize;
        const offset =
          (h ? p.top : p.left) +
          (l.align === 'center'
            ? (crossSize - c[cross]) / 2
            : l.align === 'end'
              ? crossSize - c[cross]
              : 0);
        const local = {
          x: n.x + (h ? cursor : offset) + c.width / 2,
          y: n.y + (h ? offset : cursor) + c.height / 2,
        };
        const world = transformNodePoint(local, n);
        moveSubtree(doc, c, world.x - c.width / 2, world.y - c.height / 2);
        cursor += c[axis] + gap;
      }
    }
    list.forEach(arrange);
  }
  const roots = doc.nodes.filter((n) => !n.parentId);
  roots.forEach(measure);
  roots.forEach(arrange);
}
