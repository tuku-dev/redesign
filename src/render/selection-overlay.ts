import { selectionRoots } from '../model/hierarchy.ts';
import { bounds } from '../model/geometry.ts';
import { visualBox, center, nodeTransform } from '../model/rotation.ts';
import { isLocked } from '../model/layer-state.ts';
import type { Box, ResizeHandle } from '../model/types.ts';
import type { EditorStore } from '../editor/store.ts';
import type { GestureController } from '../editor/gestures.ts';
import { svg } from './svg.ts';
import { pointerCursor, rotateCursor } from './cursors.ts';
import type { SvgAttributes } from './svg.ts';
import { renderGuides } from './guides.ts';
import { cornerRadii } from '../model/geometry.ts';
import { vectorCorners } from '../model/vector.ts';
import { fillLayers } from '../model/paint-layers.ts';
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
        const transform = nodeTransform(n);
        overlay.append(
          outline(
            { x: n.x, y: n.y, width: n.width, height: n.height },
            { 'stroke-opacity': '.45', ...(transform ? { transform } : {}) },
          ),
        );
      });
    const controls = svg('g'),
      c = center(box);
    const transform = single ? nodeTransform(single) : null;
    if (transform) controls.setAttribute('transform', transform);
    controls.append(outline(box));
    if (!roots.some((n) => isLocked(store.doc, n)) && !store.editingTextId) {
      const gradient = single && fillLayers(single).find((paint) => paint.type !== 'solid');
      if (single && gradient) {
        const handle = (point: { x: number; y: number }, name: string) => {
          const cx = single.x + point.x * single.width,
            cy = single.y + point.y * single.height;
          controls.append(
            svg('circle', {
              cx,
              cy,
              r: 5 / zoom,
              fill: 'white',
              stroke: 'var(--accent)',
              'stroke-width': 1 / zoom,
              'data-gradient-handle': name,
              cursor: 'crosshair',
            }),
          );
        };
        controls.append(
          svg('line', {
            x1: single.x + gradient.start.x * single.width,
            y1: single.y + gradient.start.y * single.height,
            x2: single.x + gradient.end.x * single.width,
            y2: single.y + gradient.end.y * single.height,
            stroke: 'var(--accent)',
            'stroke-width': 1 / zoom,
            'stroke-dasharray': `${3 / zoom} ${3 / zoom}`,
            'pointer-events': 'none',
          }),
        );
        handle(gradient.start, 'start');
        handle(gradient.end, 'end');
        if (gradient.radius) handle(gradient.radius, 'radius');
      }
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
          cursor: rotateCursor,
        }),
      );
      const addHandle = (cx: number, cy: number, selected: boolean, attrs: SvgAttributes) => {
        const hit = svg('circle', {
            cx,
            cy,
            r: (selected ? 5.5 : 4.5) / zoom,
            fill: 'var(--radius-handle)',
            'data-selected': String(selected),
            cursor: pointerCursor,
            ...attrs,
          }),
          title = svg('title');
        title.textContent = 'Drag to round corners. Double-click for one corner.';
        hit.append(title);
        controls.append(
          hit,
          svg('circle', {
            cx,
            cy,
            r: (selected ? 3.7 : 3) / zoom,
            fill: '#fff',
            'pointer-events': 'none',
          }),
          svg('circle', {
            cx,
            cy,
            r: 1.6 / zoom,
            fill: 'var(--radius-handle)',
            'pointer-events': 'none',
          }),
        );
      };
      if (single && single.type === 'rectangle') {
        const radii = cornerRadii(single),
          corners = [
            ['topLeft', box.x, box.y, 1, 1],
            ['topRight', box.x + box.width, box.y, -1, 1],
            ['bottomRight', box.x + box.width, box.y + box.height, -1, -1],
            ['bottomLeft', box.x, box.y + box.height, 1, -1],
          ] as const;
        for (const [corner, x, y, directionX, directionY] of corners) {
          const inset = 15 / zoom + radii[corner] / Math.SQRT2;
          addHandle(
            x + directionX * inset,
            y + directionY * inset,
            store.cornerRadiusCorner === corner,
            {
              'data-corner-radius': corner,
            },
          );
        }
      } else if (single?.vector?.closed) {
        for (const corner of vectorCorners(single)) {
          const distance = (15 / zoom + corner.radius) / corner.sinHalf,
            selected =
              store.cornerRadiusVertex?.ring === corner.ring &&
              store.cornerRadiusVertex.index === corner.index;
          addHandle(
            corner.point.x + corner.direction.x * distance,
            corner.point.y + corner.direction.y * distance,
            selected,
            {
              'data-corner-radius': 'vertex',
              'data-vertex-ring': corner.ring,
              'data-vertex-index': corner.index,
            },
          );
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
