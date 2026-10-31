import { pathData } from '../model/vector.ts';
import { isLocked } from '../model/layer-state.ts';
import type { DesignDocument, DesignNode } from '../model/types.ts';
import { center } from '../model/rotation.ts';
import { svg } from './svg.ts';
import { renderShape } from './shapes.ts';
let sequence = 0;
export function renderDocument(
  doc: DesignDocument,
  options: { interactive?: boolean; editingTextId?: string | null; vectorHitWidth?: number } = {},
): SVGElement[] {
  const prefix = `redesign-${sequence++}`,
    children = new Map<string | null, DesignNode[]>();
  let clipCount = 0;
  for (const n of doc.nodes) {
    const list = children.get(n.parentId) ?? [];
    list.push(n);
    children.set(n.parentId, list);
  }
  function visit(n: DesignNode): SVGElement | null {
    if (n.hidden) return null;
    const wrapper = svg('g');
    if (options.interactive && n.locked) wrapper.setAttribute('pointer-events', 'none');
    const container = n.type === 'group' || n.type === 'frame';
    if (container) wrapper.setAttribute('opacity', String(n.opacity));
    const shape = renderShape(container ? { ...n, opacity: 1 } : n);
    if (n.id === options.editingTextId) shape.setAttribute('visibility', 'hidden');
    if (options.interactive && options.vectorHitWidth && n.vector && !isLocked(doc, n)) {
      const c = center(n);
      wrapper.append(
        svg('path', {
          d: pathData(n),
          fill: n.vector.closed ? 'transparent' : 'none',
          stroke: 'transparent',
          'stroke-width': Math.max(options.vectorHitWidth, n.appearance?.strokeWidth ?? 0),
          'pointer-events': n.vector.closed ? 'all' : 'stroke',
          'data-id': n.id,
          'data-vector-hit': 'true',
          transform: 'rotate(' + n.rotation + ' ' + c.x + ' ' + c.y + ')',
        }),
      );
    }
    wrapper.append(shape);
    const content = svg('g');
    if (n.type === 'frame' && n.clipContent) {
      const id = `${prefix}-clip-${clipCount++}`,
        defs = svg('defs'),
        clip = svg('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }),
        c = center(n);
      clip.append(
        svg('rect', {
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          rx: n.radius,
          transform: `rotate(${n.rotation} ${c.x} ${c.y})`,
        }),
      );
      defs.append(clip);
      wrapper.append(defs);
      content.setAttribute('clip-path', `url(#${id})`);
    }
    for (const child of children.get(n.id) ?? []) {
      const rendered = visit(child);
      if (rendered) content.append(rendered);
    }
    if (content.childNodes.length) wrapper.append(content);
    if (!options.interactive)
      wrapper.querySelectorAll('[data-id]').forEach((el) => el.removeAttribute('data-id'));
    return wrapper;
  }
  return (children.get(null) ?? []).map(visit).filter((n): n is SVGElement => n !== null);
}
