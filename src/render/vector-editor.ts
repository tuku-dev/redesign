import type { VectorPoint } from '../model/features.ts';
import { svg } from './svg.ts';
import { pointerCursor } from './cursors.ts';
/** Screen-sized anchors and tangent handles for both the pen draft and vector editing. */
export function renderVectorPoints(
  group: SVGElement,
  rings: VectorPoint[][],
  zoom: number,
  editable: boolean,
  selected?: { ring: number; index: number },
): void {
  for (const [r, ring] of rings.entries())
    for (const [i, p] of ring.entries()) {
      for (const side of ['in', 'out'] as const) {
        const h = p[side];
        if (!h) continue;
        group.append(
          svg('line', {
            x1: p.x,
            y1: p.y,
            x2: h.x,
            y2: h.y,
            stroke: '#0d99ff',
            'stroke-width': 1 / zoom,
            'pointer-events': 'none',
          }),
        );
        group.append(
          svg('circle', {
            cx: h.x,
            cy: h.y,
            r: 3.5 / zoom,
            fill: '#0d99ff',
            stroke: 'var(--surface)',
            'stroke-width': 1 / zoom,
            ...(editable
              ? {
                  'data-vector-ring': r,
                  'data-vector-point': i,
                  'data-vector-handle': side,
                  cursor: pointerCursor,
                }
              : { 'pointer-events': 'none' }),
          }),
        );
      }
    }
  for (const [r, ring] of rings.entries())
    for (const [i, p] of ring.entries())
      group.append(
        svg('rect', {
          x: p.x - 4 / zoom,
          y: p.y - 4 / zoom,
          width: 8 / zoom,
          height: 8 / zoom,
          fill:
            selected?.ring === r && selected.index === i
              ? '#0d99ff'
              : editable
                ? 'var(--surface)'
                : i === 0
                  ? '#0d99ff'
                  : 'var(--surface)',
          stroke: '#0d99ff',
          'stroke-width': 1.5 / zoom,
          ...(editable
            ? {
                'data-vector-ring': r,
                'data-vector-point': i,
                'data-vector-anchor': 'true',
                cursor: pointerCursor,
              }
            : { 'pointer-events': 'none' }),
        }),
      );
}
