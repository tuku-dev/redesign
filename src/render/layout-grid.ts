import type { SnapBox } from '../model/snapping.ts';
import { svg } from './svg.ts';
import type { DesignDocument, DesignNode } from '../model/types.ts';
import { center } from '../model/rotation.ts';
/** Editor-only grids; they never appear in artwork exports. */
export function layoutGrid(n: DesignNode): SVGElement | null {
  const g = n.layoutGrid;
  if (n.type !== 'frame' || !g?.visible || n.hidden) return null;
  const c = center(n),
    group = svg('g', {
      'pointer-events': 'none',
      transform: `rotate(${n.rotation} ${c.x} ${c.y})`,
    });
  if (g.type === 'grid') {
    // Bound line counts for imported documents and very large frames.
    const step = Math.max(g.size, Math.max(n.width, n.height) / 2000);
    for (let x = n.x; x <= n.x + n.width; x += step)
      group.append(
        svg('line', {
          x1: x,
          x2: x,
          y1: n.y,
          y2: n.y + n.height,
          stroke: '#f24822',
          'stroke-opacity': 0.15,
          'stroke-width': 0.5,
        }),
      );
    for (let y = n.y; y <= n.y + n.height; y += step)
      group.append(
        svg('line', {
          y1: y,
          y2: y,
          x1: n.x,
          x2: n.x + n.width,
          stroke: '#f24822',
          'stroke-opacity': 0.15,
          'stroke-width': 0.5,
        }),
      );
  } else {
    const horizontal = g.type === 'columns',
      size = (horizontal ? n.width : n.height) - 2 * g.margin - g.gutter * (g.count - 1),
      band = size / g.count;
    if (band <= 0) return group;
    for (let i = 0; i < g.count; i++)
      group.append(
        svg('rect', {
          x: n.x + (horizontal ? g.margin + i * (band + g.gutter) : 0),
          y: n.y + (horizontal ? 0 : g.margin + i * (band + g.gutter)),
          width: horizontal ? band : n.width,
          height: horizontal ? n.height : band,
          fill: '#f24822',
          'fill-opacity': 0.1,
        }),
      );
  }
  return group;
}
export function guideCandidates(doc: DesignDocument): SnapBox[] {
  if (!doc.workspace?.guidesVisible) return [];
  return doc.workspace.guides.map((g) => ({
    snapAxis: g.axis,
    x: g.axis === 'x' ? g.position : -1e6,
    y: g.axis === 'y' ? g.position : -1e6,
    width: g.axis === 'x' ? 0 : 2e6,
    height: g.axis === 'y' ? 0 : 2e6,
  }));
}
