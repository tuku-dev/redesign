import type { EditorStore } from './store.ts';
import type { GestureController } from './gestures.ts';
import type { ViewportController } from './viewport.ts';
import type { EditorElements } from '../ui/elements.ts';
import { errorMessage } from '../ui/elements.ts';
import type { Notify } from '../ui/notifications.ts';
import { isResizeHandle } from '../render/selection-overlay.ts';
export function bindPointer(
  el: EditorElements,
  store: EditorStore,
  gestures: GestureController,
  viewport: ViewportController,
  notify: Notify,
  editText?: (id: string) => void,
): void {
  const canvas = el.canvas;
  const local = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return viewport.point({ x: e.clientX, y: e.clientY }, { x: r.left, y: r.top });
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (gestures.active || (e.button !== 0 && e.button !== 1)) return;
    e.preventDefault();
    canvas.focus();
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    if (store.space || store.tool === 'hand' || e.button === 1) {
      gestures.startPan({ x: e.clientX, y: e.clientY });
      return;
    }
    const target = e.target instanceof Element ? e.target : null,
      handle = target?.closest('[data-resize]')?.getAttribute('data-resize');
    if (target?.closest('[data-rotate]')) {
      gestures.startRotate(p);
      return;
    }
    if (handle && isResizeHandle(handle) && store.selected.size) {
      gestures.startResize(p, handle);
      return;
    }
    if (store.tool === 'select') {
      gestures.startSelection(
        p,
        target?.closest('[data-id]')?.getAttribute('data-id') ?? null,
        e.shiftKey,
        e.ctrlKey || e.metaKey,
      );
      return;
    }
    const text = store.tool === 'text';
    gestures.startDrawing(p);
    if (text) {
      const id = store.current()?.id;
      if (id && editText) editText(id);
      else el.properties.querySelector('textarea')?.focus();
    }
  });
  canvas.addEventListener('pointermove', (e) =>
    gestures.move(
      local(e),
      { x: e.clientX, y: e.clientY },
      { aspect: e.shiftKey, center: e.altKey, perfect: e.ctrlKey, disableSnap: e.ctrlKey },
    ),
  );
  canvas.addEventListener('pointerup', () => {
    try {
      gestures.finish();
    } catch (error) {
      notify(errorMessage(error));
    }
  });
  canvas.addEventListener('pointercancel', () => gestures.cancel());
  canvas.addEventListener('lostpointercapture', () => gestures.cancel());
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (gestures.active) return;
      const r = canvas.getBoundingClientRect();
      viewport.setZoom(store.zoom * Math.exp(-e.deltaY * 0.001), {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
      });
    },
    { passive: false },
  );
}
