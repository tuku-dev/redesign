import type { EditorStore } from './store.ts';
import type { GestureController } from './gestures.ts';
import type { ViewportController } from './viewport.ts';
import type { EditorElements } from '../ui/elements.ts';
import { errorMessage } from '../ui/elements.ts';
import type { Notify } from '../ui/notifications.ts';
import { isResizeHandle } from '../render/selection-overlay.ts';
import { pointerCursor, rotateCursor, toolCursor } from '../render/cursors.ts';
import { cornerRadii } from '../model/geometry.ts';
import { localPoint } from '../model/rotation.ts';
import { isLocked } from '../model/layer-state.ts';
import { defaultAppearance } from '../model/features.ts';
import type { CornerName, DesignDocument, Point } from '../model/types.ts';
import { vectorCorners } from '../model/vector.ts';
import { clone } from '../model/types.ts';
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
  let lastCornerClick: { key: string; time: number } | undefined;
  const setDragCursor = (value: string | null) => {
    if (value) {
      canvas.style.setProperty('--drag-cursor', value);
      canvas.setAttribute('data-drag-cursor', '');
    } else {
      canvas.style.removeProperty('--drag-cursor');
      canvas.removeAttribute('data-drag-cursor');
    }
  };
  let cornerDrag:
    | {
        before: DesignDocument;
        pointerId: number;
        nodeId: string;
        key: string;
        corner: CornerName | null;
        vertex?: { ring: number; index: number; direction: Point; sinHalf: number; max: number };
        individual: boolean;
        start: { x: number; y: number };
        direction: { x: number; y: number };
        startRadius: number;
        changed: boolean;
      }
    | undefined;
  const finishCornerDrag = (cancel: boolean) => {
    if (!cornerDrag) return;
    const { before, changed, key, individual } = cornerDrag;
    cornerDrag = undefined;
    if (cancel) {
      store.doc = before;
      store.refresh();
      return;
    }
    if (!changed) {
      lastCornerClick = { key, time: Date.now() };
      if (!cancel) store.refresh(individual ? 'all' : 'scene');
      return;
    }
    lastCornerClick = undefined;
    try {
      store.commit(before);
    } catch (error) {
      store.doc = before;
      store.refresh();
      notify(errorMessage(error));
    }
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (gestures.active || (e.button !== 0 && e.button !== 1)) return;
    if (store.canvasColorMode && e.button === 0) {
      const target = e.target instanceof Element ? e.target.closest('[data-id]') : null,
        node = store.doc.nodes.find((item) => item.id === target?.getAttribute('data-id'));
      if (!node) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const mode = store.canvasColorMode;
      store.canvasColorMode = null;
      if (mode === 'apply') {
        if (isLocked(store.doc, node)) {
          notify('Unlock this layer before applying a fill.');
          store.refresh('all');
          return;
        }
        store.selected = new Set([node.id]);
        store.change(() => (node.fill = store.canvasPaintColor));
      } else {
        const selected = store.chosen().filter((item) => !isLocked(store.doc, item));
        if (!selected.length) {
          notify('Select an unlocked layer to apply the sampled color.');
          store.refresh('all');
          return;
        }
        const stroke = e.shiftKey;
        if (stroke && !(node.appearance && node.appearance.strokeWidth > 0)) {
          notify('The clicked layer has no visible stroke.');
          store.refresh('all');
          return;
        }
        const color = stroke ? node.appearance!.stroke : node.fill;
        store.change(() =>
          selected.forEach((item) => {
            if (stroke) {
              const appearance = clone(item.appearance ?? defaultAppearance());
              appearance.stroke = color;
              appearance.strokeWidth = Math.max(1, appearance.strokeWidth);
              item.appearance = appearance;
            } else item.fill = color;
          }),
        );
      }
      return;
    }
    e.preventDefault();
    canvas.focus();
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    if (store.space || store.tool === 'hand' || e.button === 1) {
      setDragCursor('grabbing');
      gestures.startPan({ x: e.clientX, y: e.clientY });
      return;
    }
    const target = e.target instanceof Element ? e.target : null,
      corner = target?.closest('[data-corner-radius]')?.getAttribute('data-corner-radius'),
      handle = target?.closest('[data-resize]')?.getAttribute('data-resize');
    if (
      corner === 'vertex' &&
      store.chosen().length === 1 &&
      store.current()?.vector?.closed &&
      !isLocked(store.doc, store.current()!)
    ) {
      const node = store.current()!,
        holder = target!.closest('[data-corner-radius]')!,
        ring = Number(holder.getAttribute('data-vertex-ring')),
        index = Number(holder.getAttribute('data-vertex-index')),
        found = vectorCorners(node).find((c) => c.ring === ring && c.index === index);
      if (found) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const key = `vertex:${ring}:${index}`,
          selected =
            store.cornerRadiusVertex?.ring === ring && store.cornerRadiusVertex.index === index,
          individual =
            (lastCornerClick?.key === key && Date.now() - lastCornerClick.time < 500) || selected;
        lastCornerClick = undefined;
        if (individual) store.cornerRadiusVertex = { ring, index };
        setDragCursor(pointerCursor);
        cornerDrag = {
          before: clone(store.doc),
          pointerId: e.pointerId,
          nodeId: node.id,
          key,
          corner: null,
          vertex: {
            ring,
            index,
            direction: found.direction,
            sinHalf: found.sinHalf,
            max: found.maxRadius,
          },
          individual,
          start: localPoint(local(e), node),
          direction: found.direction,
          startRadius: found.radius,
          changed: false,
        };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }
    if (
      corner &&
      ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'].includes(corner) &&
      store.chosen().length === 1
    ) {
      const node = store.current();
      if (
        node &&
        (node.type === 'rectangle' || node.type === 'frame') &&
        !isLocked(store.doc, node)
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const cornerName = corner as CornerName,
          isDoubleClick =
            lastCornerClick?.key === cornerName && Date.now() - lastCornerClick.time < 500,
          individual = isDoubleClick || store.cornerRadiusCorner === cornerName,
          p = localPoint(local(e), node),
          direction = {
            x: cornerName === 'topLeft' || cornerName === 'bottomLeft' ? 1 : -1,
            y: cornerName === 'topLeft' || cornerName === 'topRight' ? 1 : -1,
          };
        lastCornerClick = undefined;
        if (individual) store.cornerRadiusCorner = cornerName;
        setDragCursor(pointerCursor);
        cornerDrag = {
          before: clone(store.doc),
          pointerId: e.pointerId,
          nodeId: node.id,
          key: cornerName,
          corner: cornerName,
          individual,
          start: p,
          direction,
          startRadius: cornerRadii(node)[cornerName],
          changed: false,
        };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }
    if (target?.closest('[data-rotate]')) {
      setDragCursor(rotateCursor);
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
  canvas.addEventListener('pointermove', (e) => {
    if (cornerDrag?.pointerId === e.pointerId) {
      const node = store.doc.nodes.find((item) => item.id === cornerDrag!.nodeId);
      if (!node) return finishCornerDrag(true);
      const p = localPoint(local(e), node);
      if (cornerDrag.vertex) {
        const { ring, index, direction, sinHalf, max } = cornerDrag.vertex,
          radius = Math.max(
            0,
            Math.min(
              max,
              cornerDrag.startRadius +
                ((p.x - cornerDrag.start.x) * direction.x +
                  (p.y - cornerDrag.start.y) * direction.y) *
                  sinHalf,
            ),
          );
        if (cornerDrag.individual) {
          const point = node.vector?.rings[ring]?.[index];
          if (point) point.radius = radius;
        } else {
          node.radius = radius;
          node.vector?.rings.forEach((points) => points.forEach((point) => delete point.radius));
        }
        cornerDrag.changed = true;
        store.refresh('all');
        return;
      }
      const delta =
          ((p.x - cornerDrag.start.x) * cornerDrag.direction.x +
            (p.y - cornerDrag.start.y) * cornerDrag.direction.y) /
          Math.SQRT2,
        maximum = Math.min(node.width, node.height) / 2,
        radius = Math.max(0, Math.min(maximum, cornerDrag.startRadius + delta));
      if (cornerDrag.individual && cornerDrag.corner)
        node.cornerRadii = { ...cornerRadii(node), [cornerDrag.corner]: radius };
      else {
        node.radius = radius;
        delete node.cornerRadii;
      }
      cornerDrag.changed = true;
      store.refresh('all');
      return;
    }
    gestures.move(
      local(e),
      { x: e.clientX, y: e.clientY },
      { aspect: e.shiftKey, center: e.altKey, perfect: e.ctrlKey, disableSnap: e.ctrlKey },
    );
  });
  const resetPointerCursor = () => {
    setDragCursor(null);
    canvas.style.cursor = toolCursor(store);
  };
  canvas.addEventListener('pointerup', () => {
    setDragCursor(null);
    if (cornerDrag) {
      finishCornerDrag(false);
      resetPointerCursor();
      return;
    }
    try {
      gestures.finish();
    } catch (error) {
      notify(errorMessage(error));
    }
  });
  canvas.addEventListener('pointercancel', () => {
    setDragCursor(null);
    if (cornerDrag) {
      finishCornerDrag(true);
      resetPointerCursor();
    } else gestures.cancel();
  });
  canvas.addEventListener('lostpointercapture', () => {
    setDragCursor(null);
    if (cornerDrag) {
      finishCornerDrag(true);
      resetPointerCursor();
    } else gestures.cancel();
  });
  canvas.addEventListener('dblclick', (e) => {
    const target = e.target instanceof Element ? e.target.closest('[data-corner-radius]') : null,
      corner = target?.getAttribute('data-corner-radius');
    if (corner === 'vertex') {
      e.preventDefault();
      e.stopPropagation();
      store.cornerRadiusVertex = {
        ring: Number(target!.getAttribute('data-vertex-ring')),
        index: Number(target!.getAttribute('data-vertex-index')),
      };
      store.refresh('scene');
      return;
    }
    if (!corner || !['topLeft', 'topRight', 'bottomRight', 'bottomLeft'].includes(corner)) return;
    e.preventDefault();
    e.stopPropagation();
    store.cornerRadiusCorner = corner as CornerName;
    store.refresh('scene');
  });
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
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !store.canvasColorMode) return;
    store.canvasColorMode = null;
    store.refresh('all');
  });
}
