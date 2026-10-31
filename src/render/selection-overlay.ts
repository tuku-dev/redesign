import { selectionRoots } from '../model/hierarchy.ts';
import { bounds } from '../model/geometry.ts';
import { visualBox, center } from '../model/rotation.ts';
import { isLocked } from '../model/layer-state.ts';
import type { Box, ResizeHandle } from '../model/types.ts';
import type { EditorStore } from '../editor/store.ts';
import type { GestureController } from '../editor/gestures.ts';
import { svg } from './svg.ts';
import type { SvgAttributes } from './svg.ts';
import { renderGuides } from './guides.ts';
import { cornerRadii } from '../model/geometry.ts';
export const handles: Record<ResizeHandle, readonly [number, number]> = {
  nw: [0, 0],
  n: [0.5, 0],
  ne: [1, 0],
  e: [1, 0.5],
  se: [1, 1],
  s: [0.5, 1],
  sw: [0, 1],
  w: [0, 0.5],
};
export function isResizeHandle(value: string): value is ResizeHandle {
  return Object.hasOwn(handles, value);
}
export function renderSelection(
  overlay: SVGGElement,
  store: EditorStore,
  gestures: GestureController,
): void {
  overlay.replaceChildren();
  const roots = selectionRoots(store.doc, store.selected),
    single = roots.length === 1 ? roots[0] : null,
    box = single
      ? { x: single.x, y: single.y, width: single.width, height: single.height }
      : bounds(roots.map(visualBox)),
    zoom = store.zoom;
  const outline = (b: Box, extra: SvgAttributes = {}) =>
    svg('rect', {
      ...b,
      fill: 'none',
      stroke: 'var(--accent)',
      'stroke-width': 1 / zoom,
      'pointer-events': 'none',
      ...extra,
    });
  if (box && !store.editingVectorId) {
    if (roots.length > 1)
      roots.forEach((n) => {
        const c = center(n);
        overlay.append(
          outline(
            { x: n.x, y: n.y, width: n.width, height: n.height },
            { 'stroke-opacity': '.45', transform: `rotate(${n.rotation} ${c.x} ${c.y})` },
          ),
        );
      });
    const controls = svg('g'),
      c = center(box);
    if (single?.rotation)
      controls.setAttribute('transform', `rotate(${single.rotation} ${c.x} ${c.y})`);
    controls.append(outline(box));
    if (!roots.some((n) => isLocked(store.doc, n)) && !store.editingTextId) {
      for (const [handle, [x, y]] of Object.entries(handles))
        controls.append(
          svg('rect', {
            x: box.x + box.width * x - 4 / zoom,
            y: box.y + box.height * y - 4 / zoom,
            width: 8 / zoom,
            height: 8 / zoom,
            fill: 'white',
            stroke: 'var(--accent)',
            'stroke-width': 1 / zoom,
            'data-resize': handle,
            cursor: `${handle}-resize`,
          }),
        );
      controls.append(
        svg('line', {
          x1: c.x,
          y1: box.y,
          x2: c.x,
          y2: box.y - 28 / zoom,
          stroke: 'var(--accent)',
          'stroke-width': 1 / zoom,
          'pointer-events': 'none',
        }),
      );
      controls.append(
        svg('circle', {
          cx: c.x,
          cy: box.y - 28 / zoom,
          r: 5 / zoom,
          fill: 'white',
          stroke: 'var(--accent)',
          'stroke-width': 1 / zoom,
          'data-rotate': 'true',
          cursor: 'grab',
        }),
      );
      if (single && (single.type === 'rectangle' || single.type === 'frame')) {
        const radii = cornerRadii(single),
          corners = [
            ['topLeft', box.x, box.y, 1, 1],
            ['topRight', box.x + box.width, box.y, -1, 1],
            ['bottomRight', box.x + box.width, box.y + box.height, -1, -1],
            ['bottomLeft', box.x, box.y + box.height, 1, -1],
          ] as const;
        for (const [corner, x, y, directionX, directionY] of corners) {
          const diagonal = radii[corner] / Math.SQRT2,
            inset = 15 / zoom + diagonal,
            handle = svg('circle', {
              cx: x + directionX * inset,
              cy: y + directionY * inset,
              r: 4 / zoom,
              fill: 'var(--canvas-bg)',
              stroke: 'var(--radius-handle)',
              'stroke-width': (store.cornerRadiusCorner === corner ? 3 : 2) / zoom,
              'data-corner-radius': corner,
              'data-selected': String(store.cornerRadiusCorner === corner),
              cursor: 'crosshair',
            }),
            title = svg('title');
          title.textContent = 'Drag to round corners. Double-click for one corner.';
          handle.append(title);
          controls.append(handle);
        }
      }
    }
    overlay.append(controls);
    if (gestures.active?.kind === 'rotate') {
      const label = svg('text', {
        x: c.x,
        y: box.y + box.height + 20 / zoom,
        'text-anchor': 'middle',
        'font-size': 11 / zoom,
        'font-family': 'Arial',
        fill: 'var(--accent)',
        'pointer-events': 'none',
      });
      label.textContent = `${Math.round(store.current()?.rotation ?? 0)}°`;
      overlay.append(label);
    }
  }
  if (gestures.active?.kind === 'marquee' && gestures.active.box)
    overlay.append(
      outline(gestures.active.box, { fill: 'var(--selection-bg)', 'fill-opacity': '.55' }),
    );
  renderGuides(overlay, gestures, zoom);
}
