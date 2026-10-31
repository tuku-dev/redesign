import type { EditorElements } from './elements.ts';
import type { EditorStore } from '../editor/store.ts';
import type { Notify } from './notifications.ts';
import { clone } from '../model/types.ts';
import type { DesignDocument } from '../model/types.ts';
import { ensureWorkspace } from '../model/workspace.ts';
import { svg } from '../render/svg.ts';
export function bindRulers(el: EditorElements, store: EditorStore, notify: Notify): void {
  const overlay = svg('g', { 'data-editor-overlay': 'true' });
  el.canvas.append(overlay);
  let drag: { id: string; before: DesignDocument; pointerId: number } | null = null;
  const render = () => {
    overlay.replaceChildren();
    const w = store.doc.workspace;
    if (!w) return;
    const { width, height } = el.canvas.getBoundingClientRect();
    if (w.guidesVisible)
      for (const g of w.guides) {
        const p = (g.axis === 'x' ? store.pan.x : store.pan.y) + g.position * store.zoom;
        const coords =
          g.axis === 'x' ? { x1: p, x2: p, y1: 0, y2: height } : { x1: 0, x2: width, y1: p, y2: p };
        overlay.append(
          svg('line', {
            ...coords,
            stroke: 'transparent',
            'stroke-width': 10,
            'data-guide': g.id,
            style: `cursor:${g.axis === 'x' ? 'ew-resize' : 'ns-resize'}`,
          }),
        );
        overlay.append(
          svg('line', {
            ...coords,
            stroke: '#0d99ff',
            'stroke-width': 1,
            'pointer-events': 'none',
          }),
        );
      }
    if (!w.rulers) return;
    for (const axis of ['x', 'y'] as const) {
      const length = axis === 'x' ? width : height,
        pan = axis === 'x' ? store.pan.x : store.pan.y;
      overlay.append(
        svg('rect', {
          x: 0,
          y: 0,
          width: axis === 'x' ? width : 20,
          height: axis === 'x' ? 20 : height,
          fill: 'var(--surface-secondary)',
          'data-ruler-axis': axis,
          style: 'cursor:crosshair',
        }),
      );
      const raw = 80 / store.zoom,
        power = 10 ** Math.floor(Math.log10(raw)),
        step = [1, 2, 5, 10].map((v) => v * power).find((v) => v >= raw)!;
      const first = Math.ceil(-pan / store.zoom / step) * step;
      for (let v = first; v * store.zoom + pan < length; v += step) {
        const p = v * store.zoom + pan;
        if (p < 20) continue;
        const line =
          axis === 'x' ? { x1: p, x2: p, y1: 14, y2: 20 } : { x1: 14, x2: 20, y1: p, y2: p };
        overlay.append(
          svg('line', { ...line, stroke: 'var(--text-secondary)', 'pointer-events': 'none' }),
        );
        const text = svg('text', {
          x: axis === 'x' ? p + 3 : 3,
          y: axis === 'x' ? 10 : p - 3,
          'font-size': 9,
          fill: 'var(--text-secondary)',
          'pointer-events': 'none',
        });
        text.textContent = String(Math.round(v * 100) / 100);
        overlay.append(text);
      }
    }
  };
  const position = (e: PointerEvent, axis: 'x' | 'y') => {
    const r = el.canvas.getBoundingClientRect();
    return (
      ((axis === 'x' ? e.clientX - r.left : e.clientY - r.top) -
        (axis === 'x' ? store.pan.x : store.pan.y)) /
      store.zoom
    );
  };
  overlay.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const target = e.target as Element,
      id = target.getAttribute('data-guide'),
      axis = target.getAttribute('data-ruler-axis');
    if (!id && !axis) return;
    e.stopPropagation();
    e.preventDefault();
    const before = clone(store.doc),
      w = ensureWorkspace(store.doc);
    let guide = w.guides.find((g) => g.id === id);
    if (!guide && (axis === 'x' || axis === 'y')) {
      guide = { id: crypto.randomUUID(), axis, position: position(e, axis) };
      w.guides.push(guide);
      w.guidesVisible = true;
    }
    if (!guide) return;
    drag = { id: guide.id, before, pointerId: e.pointerId };
    el.canvas.setPointerCapture(e.pointerId);
    store.refresh('scene');
  });
  el.canvas.addEventListener('pointermove', (e) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const guide = store.doc.workspace?.guides.find((g) => g.id === drag!.id);
    if (guide) guide.position = Math.round(position(e, guide.axis) * 100) / 100;
    store.refresh('scene');
  });
  const finish = (cancel: boolean) => {
    if (!drag) return;
    const before = drag.before;
    drag = null;
    if (cancel) {
      store.doc = before;
      store.refresh();
      return;
    }
    try {
      store.commit(before);
    } catch {
      store.doc = before;
      store.refresh();
      notify('Guide position is outside the supported range.');
    }
  };
  el.canvas.addEventListener('pointerup', () => finish(false));
  el.canvas.addEventListener('pointercancel', () => finish(true));
  el.canvas.addEventListener('lostpointercapture', () => finish(true));
  window.addEventListener('blur', () => finish(true));
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && drag) {
        e.stopImmediatePropagation();
        finish(true);
      }
    },
    true,
  );
  overlay.addEventListener('dblclick', (e) => {
    const id = (e.target as Element).getAttribute('data-guide');
    if (!id) return;
    e.stopPropagation();
    store.change(() => {
      const w = ensureWorkspace(store.doc);
      w.guides = w.guides.filter((g) => g.id !== id);
    });
  });
  store.subscribe(render);
  window.addEventListener('resize', render);
  render();
}
