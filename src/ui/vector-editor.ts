import { segmentParameter } from '../model/vector-edit.ts';
import type { EditorElements } from './elements.ts';
import type { EditorStore } from '../editor/store.ts';
import type { GestureController } from '../editor/gestures.ts';
import type { ViewportController } from '../editor/viewport.ts';
import type { Notify } from './notifications.ts';
import type { Point, DesignDocument } from '../model/types.ts';
import type { VectorPoint } from '../model/features.ts';
import { clone } from '../model/types.ts';
import { toolCursor } from '../render/cursors.ts';
import { transformNodePoint, localPoint } from '../model/rotation.ts';
import { isLocked, isHidden } from '../model/layer-state.ts';
import { bezierPathData, mapVectorPoint, moveAnchor, moveHandle } from '../model/bezier.ts';
import { FeatureCommands } from '../commands/features.ts';
import { strokeToVector } from '../model/pencil.ts';
import { renderVectorPoints } from '../render/vector-editor.ts';
import { svg } from '../render/svg.ts';
import { errorMessage } from './elements.ts';
type HandleSide = 'in' | 'out';
export function bindVectorEditor(
  el: EditorElements,
  store: EditorStore,
  gestures: GestureController,
  viewport: ViewportController,
  notify: Notify,
) {
  let drawing = false,
    points: VectorPoint[] = [],
    hover: Point | null = null;
  let placing: { index: number; pointerId: number; before: VectorPoint[] } | null = null;
  let ctrlHeld = false;
  let pencilOn = false,
    stroke: { points: Point[]; pointerId: number } | null = null;
  let draftDrag: {
    index: number;
    side: HandleSide | null;
    pointerId: number;
    before: VectorPoint[];
  } | null = null;
  let drag: {
    ring: number;
    index: number;
    side: HandleSide | null;
    id: string;
    before: DesignDocument;
    pointerId: number;
  } | null = null;
  const isEditing = () =>
    store.editingVectorId !== null && store.editingVectorId === store.current()?.id;
  type VectorHit = {
    id: string;
    ring: string | null;
    index: string | null;
    side: string | null;
    time: number;
    x: number;
    y: number;
  };
  let anchorSelection: { id: string; ring: number; index: number } | null = null;
  let lastHit: VectorHit | null = null,
    lastTap: VectorHit | null = null,
    lastDoubleAt = -Infinity;
  const modeBar = document.createElement('div'),
    modeText = document.createElement('span'),
    modeButton = document.createElement('button');
  modeBar.className = 'vector-edit-bar';
  modeBar.hidden = true;
  modeBar.setAttribute('role', 'status');
  modeButton.type = 'button';
  modeBar.append(modeText, modeButton);
  el.workspace.append(modeBar);
  const overlay = svg('g', { 'data-vector-editor': 'true' });
  el.viewport.append(overlay);
  const local = (e: PointerEvent) => {
    const r = el.canvas.getBoundingClientRect();
    return viewport.point({ x: e.clientX, y: e.clientY }, { x: r.left, y: r.top });
  };
  const constrain = (p: Point, origin: Point) => {
    const dx = p.x - origin.x,
      dy = p.y - origin.y,
      angle = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4,
      length = Math.hypot(dx, dy);
    return { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length };
  };
  function enterEdit(id: string): void {
    const n = store.doc.nodes.find((n) => n.id === id);
    if (!n?.vector || isLocked(store.doc, n) || isHidden(store.doc, n)) return;
    gestures.cancel();
    stop(true);
    drawing = false;
    points = [];
    hover = null;
    store.selected = new Set([id]);
    store.tool = 'select';
    store.editingVectorId = id;
    anchorSelection = null;
    el.canvas.focus();
    store.refresh();
  }
  const directButton = document.querySelector<HTMLButtonElement>('#direct-select');
  if (!directButton) throw new Error('Missing pointer tool button');
  directButton.onclick = () => {
    if (!isEditing()) return;
    store.editingVectorId = null;
    store.refresh();
    el.canvas.focus();
  };
  modeButton.onclick = () => {
    if (isEditing()) {
      store.editingVectorId = null;
      store.refresh();
      el.canvas.focus();
    } else if (store.current()?.vector) enterEdit(store.current()!.id);
  };
  function render(): void {
    const current = store.current(),
      active = isEditing();
    modeBar.hidden =
      drawing || !current?.vector || isLocked(store.doc, current) || isHidden(store.doc, current);
    modeText.textContent = active ? 'Editing vector - drag anchors or handles' : 'Vector selected';
    modeButton.textContent = active ? 'Done' : 'Edit vector';
    el.canvas.toggleAttribute('data-vector-editing', active);
    const pointerShown = active || (drawing && ctrlHeld);
    const penButton = document.querySelector<HTMLButtonElement>('#pen-tool');
    if (penButton) penButton.hidden = pointerShown;
    penButton?.classList.toggle('active', drawing || pencilOn);
    penButton?.setAttribute('aria-pressed', String(drawing || pencilOn));
    penButton?.parentElement?.toggleAttribute('hidden', pointerShown);
    directButton!.hidden = !pointerShown;
    directButton!.classList.toggle('active', pointerShown);
    el.toolButtons.forEach((b) => {
      const active = !drawing && !pencilOn && b.dataset.tool === store.tool && !isEditing();
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    overlay.replaceChildren();
    el.canvas.style.cursor = toolCursor(store, drawing || pencilOn);
    if (stroke && stroke.points.length > 1)
      overlay.append(
        svg('path', {
          d: bezierPathData([stroke.points], false),
          fill: 'none',
          stroke: 'var(--text-primary)',
          'stroke-width': 1.5 / store.zoom,
          'pointer-events': 'none',
          'data-pencil-preview': 'true',
        }),
      );
    if (drawing && points.length) {
      const preview = hover && !placing && !ctrlHeld ? [...points, hover] : points;
      overlay.append(
        svg('path', {
          d: bezierPathData([preview], false),
          fill: 'none',
          stroke: 'var(--text-primary)',
          'stroke-width': 1.5 / store.zoom,
          'pointer-events': 'none',
          'data-pen-preview': 'true',
        }),
      );
      renderVectorPoints(overlay, [points], store.zoom, ctrlHeld);
    }
    const n = store.current();
    if (n?.vector && !drawing && !isHidden(store.doc, n)) {
      const selected = n.vector.rings.map((r) =>
        r.map((p) =>
          mapVectorPoint(p, (q) =>
            transformNodePoint({ x: n.x + q.x * n.width, y: n.y + q.y * n.height }, n),
          ),
        ),
      );
      overlay.append(
        svg('path', {
          d: bezierPathData(selected, n.vector.closed),
          fill: 'none',
          stroke: '#0d99ff',
          'stroke-width': 1 / store.zoom,
          'pointer-events': 'none',
        }),
      );
    }
    if (isEditing() && n?.vector && !isLocked(store.doc, n) && !isHidden(store.doc, n)) {
      const world = n.vector.rings.map((r) =>
        r.map((p) =>
          mapVectorPoint(p, (q) =>
            transformNodePoint({ x: n.x + q.x * n.width, y: n.y + q.y * n.height }, n),
          ),
        ),
      );
      world.forEach((ring, r) => {
        const count = ring.length - (n.vector!.closed ? 0 : 1);
        for (let i = 0; i < count; i++)
          overlay.append(
            svg('path', {
              d: bezierPathData([[ring[i], ring[(i + 1) % ring.length]]], false),
              fill: 'none',
              stroke: 'transparent',
              'stroke-width': 10 / store.zoom,
              'data-id': n.id,
              'data-vector-segment': 'true',
              'data-vector-segment-ring': r,
              'data-vector-segment-point': i,
              cursor: 'crosshair',
            }),
          );
      });
      renderVectorPoints(
        overlay,
        world,
        store.zoom,
        true,
        anchorSelection?.id === n.id ? anchorSelection : undefined,
      );
    }
  }
  function finish(closed: boolean): void {
    if (!drawing || placing) return;
    const hasCurve = points.some((p) => p.in || p.out);
    if (points.length < 2 || (closed && points.length < 3 && !hasCurve)) {
      notify(closed ? 'Add three corner points or two curve points.' : 'Add at least two points.');
      return;
    }
    try {
      new FeatureCommands(store).path(points, closed);
      drawing = false;
      points = [];
      hover = null;
      store.refresh();
      render();
      notify('Vector created. Double-click it or use Edit points to adjust anchors and handles.');
    } catch (error) {
      notify(errorMessage(error));
    }
  }
  function stop(cancel: boolean): void {
    if (stroke && cancel) {
      stroke = null;
      render();
    }
    if (draftDrag) {
      if (cancel) points = draftDrag.before;
      draftDrag = null;
      render();
    }
    if (placing) {
      if (cancel) points = placing.before;
      placing = null;
      hover = null;
      render();
    }
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
    } catch (error) {
      store.doc = before;
      store.refresh();
      notify(errorMessage(error));
    }
  }
  function cancelDraft(): void {
    lastHit = null;
    lastTap = null;
    const wasEditing = store.editingVectorId !== null;
    stop(true);
    drawing = false;
    pencilOn = false;
    store.editingVectorId = null;
    points = [];
    hover = null;
    if (wasEditing) store.refresh('scene');
    else render();
  }
  el.canvas.addEventListener(
    'pointerdown',
    (e) => {
      lastHit = null;
      if (store.canvasColorMode) {
        lastTap = null;
        return;
      }
      if (e.button !== 0 || (e.target as Element).closest('[data-editor-overlay]')) return;
      const target = e.target as Element;
      const segment = target.hasAttribute('data-vector-segment'),
        r = target.getAttribute(segment ? 'data-vector-segment-ring' : 'data-vector-ring'),
        i = target.getAttribute(segment ? 'data-vector-segment-point' : 'data-vector-point'),
        side = segment ? 'segment' : target.getAttribute('data-vector-handle');
      const hitId =
        target.closest('[data-id]')?.getAttribute('data-id') ??
        ((r !== null && i !== null) || target.closest('[data-resize],[data-rotate]')
          ? store.current()?.id
          : null);
      lastHit =
        !drawing &&
        !store.space &&
        store.tool === 'select' &&
        !e.shiftKey &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        hitId &&
        store.doc.nodes.some(
          (n) => n.id === hitId && (n.vector || n.type === 'rectangle' || n.type === 'ellipse'),
        )
          ? { id: hitId, ring: r, index: i, side, time: e.timeStamp, x: e.clientX, y: e.clientY }
          : null;
      if (isEditing() && side === 'segment') {
        e.preventDefault();
        e.stopImmediatePropagation();
        el.canvas.focus();
        return;
      }
      if (
        isEditing() &&
        r !== null &&
        i !== null &&
        store.current() &&
        !isLocked(store.doc, store.current()!)
      ) {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (e.altKey && !side) {
          new FeatureCommands(store).pointKind(Number(r), Number(i), false);
          return;
        }
        anchorSelection = { id: store.current()!.id, ring: Number(r), index: Number(i) };
        drag = {
          id: store.current()!.id,
          ring: Number(r),
          index: Number(i),
          side: side === 'in' || side === 'out' ? side : null,
          before: clone(store.doc),
          pointerId: e.pointerId,
        };
        el.canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (pencilOn && !isEditing() && !store.space) {
        e.stopImmediatePropagation();
        e.preventDefault();
        stroke = { points: [local(e)], pointerId: e.pointerId };
        el.canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (!drawing) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (ctrlHeld) {
        if (r !== null && i !== null && points[Number(i)]) {
          draftDrag = {
            index: Number(i),
            side: side === 'in' || side === 'out' ? side : null,
            pointerId: e.pointerId,
            before: clone(points),
          };
          el.canvas.setPointerCapture(e.pointerId);
        }
        return;
      }
      let p = local(e);
      const first = points[0],
        canClose = points.length >= 3 || (points.length >= 2 && points.some((p) => p.in || p.out));
      if (first && canClose && Math.hypot(first.x - p.x, first.y - p.y) <= 8 / store.zoom) {
        finish(true);
        return;
      }
      if (e.detail > 1) return;
      if (e.shiftKey && points.length) p = constrain(p, points.at(-1)!);
      placing = { index: points.length, pointerId: e.pointerId, before: clone(points) };
      points.push(p);
      hover = null;
      el.canvas.setPointerCapture(e.pointerId);
      render();
    },
    true,
  );
  el.canvas.addEventListener('pointermove', (e) => {
    if (stroke && stroke.pointerId === e.pointerId) {
      const p = local(e),
        last = stroke.points.at(-1)!;
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 1 / store.zoom) {
        stroke.points.push(p);
        render();
      }
      return;
    }
    if (draftDrag && draftDrag.pointerId === e.pointerId) {
      const point = points[draftDrag.index];
      if (point) {
        if (draftDrag.side) moveHandle(point, draftDrag.side, local(e), e.altKey);
        else moveAnchor(point, local(e));
      }
      render();
      return;
    }
    if (placing && placing.pointerId === e.pointerId) {
      const p = points[placing.index];
      let handle = local(e);
      if (e.shiftKey) handle = constrain(handle, p);
      if (Math.hypot(handle.x - p.x, handle.y - p.y) > 3 / store.zoom) {
        p.out = { ...handle };
        p.in = { x: 2 * p.x - handle.x, y: 2 * p.y - handle.y };
        p.smooth = true;
      }
      render();
      return;
    }
    if (drag && drag.pointerId === e.pointerId) {
      const n = store.doc.nodes.find((n) => n.id === drag!.id);
      if (!n?.vector) return;
      let p = localPoint(local(e), n);
      const vertex = n.vector.rings[drag.ring]?.[drag.index];
      if (!vertex) return;
      if (drag.side && e.shiftKey)
        p = constrain(p, { x: n.x + vertex.x * n.width, y: n.y + vertex.y * n.height });
      const normalized = { x: (p.x - n.x) / n.width, y: (p.y - n.y) / n.height };
      if (drag.side)
        moveHandle(vertex, drag.side, normalized, e.altKey, { x: n.width, y: n.height });
      else moveAnchor(vertex, normalized);
      store.refresh('scene');
      return;
    }
    if (drawing) {
      hover = local(e);
      if (e.shiftKey && points.length) hover = constrain(hover, points.at(-1)!);
      render();
    }
  });
  // Pointer prevention suppresses native mouse double-clicks; SVG redraws also replace targets.
  function finishStroke(): void {
    const done = stroke;
    stroke = null;
    if (!done || done.points.length < 2) return render();
    try {
      new FeatureCommands(store).path(strokeToVector(done.points, 2 / store.zoom), false);
      store.refresh();
      render();
    } catch (error) {
      render();
      notify(errorMessage(error));
    }
  }
  el.canvas.addEventListener('pointerup', (e) => {
    if (stroke && stroke.pointerId === e.pointerId) {
      finishStroke();
      return;
    }
    const hit = lastHit;
    lastHit = null;
    stop(false);
    if (
      !hit ||
      Math.hypot(e.clientX - hit.x, e.clientY - hit.y) > 5 ||
      e.timeStamp - hit.time > 500
    ) {
      lastTap = null;
      return;
    }
    if (
      lastTap &&
      lastTap.id === hit.id &&
      lastTap.ring === hit.ring &&
      lastTap.index === hit.index &&
      lastTap.side === hit.side &&
      e.timeStamp - lastTap.time <= 500 &&
      Math.hypot(hit.x - lastTap.x, hit.y - lastTap.y) <= 5
    ) {
      lastTap = null;
      lastDoubleAt = e.timeStamp;
      if (isEditing() && hit.side === 'segment' && hit.ring !== null && hit.index !== null) {
        const n = store.current()!,
          r = Number(hit.ring),
          i = Number(hit.index),
          ring = n.vector!.rings[r];
        const p = localPoint(local(e), n),
          t = segmentParameter(
            ring[i],
            ring[(i + 1) % ring.length],
            { x: (p.x - n.x) / n.width, y: (p.y - n.y) / n.height },
            { x: n.width, y: n.height },
          );
        new FeatureCommands(store).insertVertex(r, i, t);
        anchorSelection = { id: n.id, ring: r, index: i + 1 };
      } else if (isEditing() && hit.ring !== null && hit.index !== null && !hit.side) {
        const p = store.current()?.vector?.rings[Number(hit.ring)]?.[Number(hit.index)];
        if (p)
          new FeatureCommands(store).pointKind(
            Number(hit.ring),
            Number(hit.index),
            !p.in && !p.out,
          );
      } else {
        new FeatureCommands(store).toVector(hit.id);
        enterEdit(hit.id);
      }
    } else lastTap = { ...hit, time: e.timeStamp };
  });
  el.canvas.addEventListener('pointercancel', () => stop(true));
  el.canvas.addEventListener('lostpointercapture', () => stop(true));
  el.canvas.addEventListener('pointerleave', () => {
    hover = null;
    if (!placing) render();
  });
  el.canvas.addEventListener(
    'dblclick',
    (e) => {
      if (e.timeStamp - lastDoubleAt < 100) {
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }
      if (drawing) {
        e.stopImmediatePropagation();
        e.preventDefault();
        finish(false);
        return;
      }
      const target = e.target as Element;
      const r = target.getAttribute('data-vector-ring'),
        i = target.getAttribute('data-vector-point'),
        side = target.getAttribute('data-vector-handle');
      if (isEditing() && r != null && i != null && !side) {
        e.stopImmediatePropagation();
        e.preventDefault();
        const p = store.current()?.vector?.rings[Number(r)]?.[Number(i)];
        if (p) new FeatureCommands(store).pointKind(Number(r), Number(i), !p.in && !p.out);
        return;
      }
      const id = target.closest('[data-id]')?.getAttribute('data-id');
      if (id && store.doc.nodes.some((n) => n.id === id && n.vector)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        enterEdit(id);
      }
    },
    true,
  );
  const trackCtrl = (e: KeyboardEvent, down: boolean) => {
    if (e.key !== 'Control' || ctrlHeld === down) return;
    ctrlHeld = down;
    if (drawing) render();
  };
  document.addEventListener('keydown', (e) => trackCtrl(e, true), true);
  document.addEventListener('keyup', (e) => trackCtrl(e, false), true);
  document.addEventListener(
    'keydown',
    (e) => {
      if ((e.target as Element)?.closest?.('input,textarea,select,dialog,[contenteditable]'))
        return;
      if (isEditing() && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (anchorSelection?.id === store.current()?.id) {
          try {
            new FeatureCommands(store).deleteVertex(anchorSelection!.ring, anchorSelection!.index);
            anchorSelection = null;
          } catch (error) {
            notify(errorMessage(error));
          }
        } else notify('Select an anchor or use its Delete button in Vector points.');
        return;
      }
      if (e.key === 'Escape') lastTap = null;
      if ((drag || placing || draftDrag) && e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        stop(true);
        if (drawing) {
          drawing = false;
          points = [];
          hover = null;
        }
        store.refresh();
        return;
      }
      if (isEditing() && e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        store.editingVectorId = null;
        store.refresh();
        return;
      }
      if (
        !drawing &&
        !isEditing() &&
        e.key === 'Enter' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.shiftKey &&
        store.current()?.vector
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        enterEdit(store.current()!.id);
        return;
      }
      if (pencilOn && e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        cancelDraft();
        store.refresh();
        return;
      }
      if (pencilOn && /^[vhfrlot]$/i.test(e.key) && !e.ctrlKey && !e.metaKey) cancelDraft();
      if (!drawing) return;
      e.stopImmediatePropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelDraft();
        store.refresh();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        finish(e.shiftKey);
      } else if (
        e.key === 'Backspace' ||
        e.key === 'Delete' ||
        ((e.ctrlKey || e.metaKey) && e.key === 'z')
      ) {
        e.preventDefault();
        if (!placing) points.pop();
        render();
      }
    },
    true,
  );
  el.toolButtons.forEach((b) => b.addEventListener('click', cancelDraft));
  el.shapeMenu.querySelectorAll('button').forEach((b) => b.addEventListener('click', cancelDraft));
  el.textMenu.querySelectorAll('button').forEach((b) => b.addEventListener('click', cancelDraft));
  document.addEventListener('redesign:before-save', () => {
    stop(false);
    if (drawing && points.length >= 2) finish(false);
  });
  window.addEventListener('blur', () => {
    lastHit = null;
    lastTap = null;
    ctrlHeld = false;
    stop(true);
  });
  let pageId = store.doc.workspace?.activePageId;
  store.subscribe(() => {
    const next = store.doc.workspace?.activePageId;
    if (next !== pageId) {
      drawing = false;
      store.editingVectorId = null;
      points = [];
      placing = null;
      drag = null;
      hover = null;
      lastHit = null;
      lastTap = null;
      pageId = next;
    }
    render();
  });
  return {
    start: () => {
      gestures.cancel();
      cancelDraft();
      drawing = true;
      store.tool = 'select';
      el.canvas.focus();
      render();
      notify(
        'Pen: click for corners; drag for curves. Enter finishes; click the first point to close.',
      );
    },
    startPencil: () => {
      gestures.cancel();
      cancelDraft();
      pencilOn = true;
      store.tool = 'select';
      el.canvas.focus();
      render();
      notify('Pencil: drag on the canvas to draw freehand. Escape exits.');
    },
    edit: () => {
      const n = store.current();
      if (!n?.vector) return notify('Select a vector path first.');
      if (isEditing()) {
        store.editingVectorId = null;
        store.refresh();
        el.canvas.focus();
      } else enterEdit(n.id);
    },
    cancel: cancelDraft,
    finish: () => finish(false),
    close: () => finish(true),
  };
}
