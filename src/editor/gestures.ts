import { withinClips } from '../model/clipping.ts';
import { guideCandidates } from '../render/layout-grid.ts';
import type { SnapBox } from '../model/snapping.ts';
import { clippedVisualBox } from '../model/render-bounds.ts';
import { editableNodes, isLocked, isHidden, groupedTarget } from '../model/layer-state.ts';
import { drawingBox } from '../model/drawing.ts';
import {
  DEFAULT_POLYGON_SIDES,
  DEFAULT_STAR_POINTS,
  MAX_SIDES,
  MIN_SIDES,
  RECTANGLE_SIDES,
  applyArrow,
  applyLine,
  applyPolygonSides,
  applyStarPoints,
  snapLineAngle,
} from '../model/shapes.ts';
import type { DrawShape } from '../model/shapes.ts';
import {
  descendants,
  selectionRoots,
  reparentSelection,
  adoptEnclosed,
} from '../model/hierarchy.ts';
import { createNode } from '../model/document.ts';
import { bounds } from '../model/geometry.ts';
import { boxBetween, marqueeIds, toggleId } from '../model/selection.ts';
import { center, rotatePoint, visualBox, angleAt, normalizeAngle } from '../model/rotation.ts';
import { snapTranslation, snapPoint, snapToGrid } from '../model/snapping.ts';
import type { Guide, Measurement } from '../model/snapping.ts';
import { resizeFrame } from '../model/constraints.ts';
import { clone } from '../model/types.ts';
import type { Box, DesignDocument, DesignNode, Point, ResizeHandle } from '../model/types.ts';
import { translateNodes, resizeBox, resizeOrientedNodes } from '../commands/transforms.ts';
import { rotateNodes } from '../commands/rotation.ts';
import type { EditorStore } from './store.ts';
interface BaseGesture {
  before: DesignDocument;
  selection: Set<string>;
  start: Point;
}
export type Gesture = BaseGesture &
  (
    | { kind: 'pan'; pan: Point }
    | {
        kind: 'move';
        nodes: DesignNode[];
        roots: DesignNode[];
        moveAxis?: 'x' | 'y';
        deselectOnClick?: string;
      }
    | {
        kind: 'rotate';
        nodes: DesignNode[];
        pivot: Point;
        startAngle: number;
        initialRotation: number;
      }
    | {
        kind: 'resize';
        nodes: DesignNode[];
        bounds: Box;
        handle: ResizeHandle;
        roots: DesignNode[];
        angle: number;
        pivot: Point;
      }
    | { kind: 'marquee'; base: Set<string>; box?: Box; nested?: boolean }
    | { kind: 'draw'; shape: DrawShape | null; sides: number }
  );
export interface GestureModifiers {
  aspect: boolean;
  center: boolean;
  perfect?: boolean;
  disableSnap?: boolean;
  deepSelect?: boolean;
}
export class GestureController {
  active: Gesture | null = null;
  guides: Guide[] = [];
  measurements: Measurement[] = [];
  constructor(private readonly store: EditorStore) {}
  private base(start: Point, selection = this.store.selected): BaseGesture {
    this.guides = [];
    this.measurements = [];
    return { before: clone(this.store.doc), selection: new Set(selection), start };
  }
  private roots(): DesignNode[] {
    const s = this.store;
    return clone(selectionRoots(s.doc, new Set(editableNodes(s.doc, s.selected).map((n) => n.id))));
  }
  private candidates(g: Gesture): SnapBox[] {
    const moving = new Set('nodes' in g ? g.nodes.map((n) => n.id) : this.store.selected);
    return [
      ...guideCandidates(g.before),
      ...g.before.nodes
        .filter((n) => !moving.has(n.id) && n.type !== 'group' && !isHidden(g.before, n))
        .flatMap((n) => {
          const box = clippedVisualBox(g.before, n);
          return box ? [box] : [];
        }),
    ];
  }
  startPan(client: Point): void {
    this.active = { ...this.base(client), kind: 'pan', pan: { ...this.store.pan } };
  }
  startRotate(point: Point): void {
    const roots = this.roots(),
      box = bounds(roots.map(visualBox));
    if (!box) return;
    const pivot = roots.length === 1 ? center(roots[0]) : center(box);
    this.active = {
      ...this.base(point),
      kind: 'rotate',
      nodes: clone(descendants(this.store.doc, new Set(roots.map((n) => n.id)))),
      pivot,
      startAngle: angleAt(point, pivot),
      initialRotation: roots.length === 1 ? roots[0].rotation : 0,
    };
  }
  startResize(point: Point, handle: ResizeHandle): void {
    const roots = this.roots(),
      box =
        roots.length === 1
          ? { x: roots[0].x, y: roots[0].y, width: roots[0].width, height: roots[0].height }
          : bounds(roots.map(visualBox));
    if (!box) return;
    const pivot = center(box),
      angle = roots.length === 1 ? roots[0].rotation : 0;
    this.active = {
      ...this.base(rotatePoint(point, pivot, -angle)),
      kind: 'resize',
      nodes: clone(descendants(this.store.doc, new Set(roots.map((n) => n.id)))),
      bounds: box,
      handle,
      roots,
      angle,
      pivot,
    };
  }
  startSelection(point: Point, id: string | null, additive: boolean, deep = false): void {
    const s = this.store;
    const previousSelection = new Set(s.selected);
    let nestedMarquee = false;
    if (id) {
      const n = s.doc.nodes.find((n) => n.id === id);
      if (!n || isLocked(s.doc, n) || isHidden(s.doc, n)) return;
      if (!withinClips(s.doc, n, point)) id = null;
      else if (n.type === 'frame' && !s.selected.has(id) && !deep) {
        nestedMarquee = true;
        id = null;
      } else if (!s.selected.has(id) || deep) id = groupedTarget(s.doc, id, deep);
    }
    if (id) {
      const deselectOnClick = additive && s.selected.has(id) ? id : undefined;
      s.selected = additive
        ? deselectOnClick
          ? s.selected
          : toggleId(s.selected, id)
        : s.selected.has(id)
          ? s.selected
          : new Set([id]);
      if (s.selected.has(id)) {
        const roots = this.roots();
        this.active = {
          ...this.base(point, previousSelection),
          kind: 'move',
          roots,
          nodes: clone(descendants(s.doc, new Set(roots.map((n) => n.id)))),
          deselectOnClick,
        };
      }
    } else {
      const base = additive ? new Set(s.selected) : new Set<string>();
      this.active = {
        ...this.base(point, previousSelection),
        kind: 'marquee',
        base,
        nested: nestedMarquee,
      };
      s.selected = new Set(base);
    }
    s.refresh();
  }
  startDrawing(point: Point): void {
    const s = this.store;
    if (s.tool === 'select' || s.tool === 'hand') return;
    const start = s.gridSnappingEnabled ? snapToGrid(point, s.snapGridSize, s.zoom).point : point;
    const shape = s.tool === 'rectangle' ? s.drawShape : null;
    this.active = {
      ...this.base(start),
      kind: 'draw',
      shape,
      sides:
        shape === 'star'
          ? DEFAULT_STAR_POINTS
          : shape === 'polygon'
            ? DEFAULT_POLYGON_SIDES
            : RECTANGLE_SIDES,
    };
    const text = s.tool === 'text',
      n = createNode(s.tool, { ...start, width: text ? 240 : 1, height: text ? 40 : 1 });
    if (shape === 'star') applyStarPoints(n, DEFAULT_STAR_POINTS);
    if (shape === 'polygon') applyPolygonSides(n, DEFAULT_POLYGON_SIDES, true);
    if (shape === 'line') applyLine(n, start, start);
    if (shape === 'arrow') applyArrow(n, start, start);
    s.doc.nodes.push(n);
    s.selected = new Set([n.id]);
    if (text) this.finish();
    else s.refresh();
  }
  /** While drawing a rectangle or star, changes its side or point count (3-60); a 4-sided rectangle is a plain rectangle. */
  adjustSides(delta: number): boolean {
    const g = this.active,
      n = this.store.current();
    if (g?.kind !== 'draw' || !n || !g.shape || !['rectangle', 'polygon', 'star'].includes(g.shape))
      return false;
    g.sides = Math.min(MAX_SIDES, Math.max(MIN_SIDES, g.sides + delta));
    if (g.shape === 'star') applyStarPoints(n, g.sides);
    else applyPolygonSides(n, g.sides, g.shape === 'polygon');
    this.store.refresh('scene');
    return true;
  }
  move(point: Point, client: Point, modifiers: GestureModifiers): void {
    const g = this.active;
    const s = this.store;
    if (!g) return;
    this.guides = [];
    this.measurements = [];
    if (g.kind === 'pan')
      s.pan = { x: g.pan.x + client.x - g.start.x, y: g.pan.y + client.y - g.start.y };
    else if (g.kind === 'move') {
      const pointerDx = point.x - g.start.x,
        pointerDy = point.y - g.start.y;
      if (Math.hypot(pointerDx, pointerDy) * s.zoom < 3) return;
      if (modifiers.aspect) {
        g.moveAxis ??= Math.abs(pointerDx) >= Math.abs(pointerDy) ? 'x' : 'y';
      } else g.moveAxis = undefined;
      const dx = g.moveAxis === 'y' ? 0 : pointerDx,
        dy = g.moveAxis === 'x' ? 0 : pointerDy;
      const box = bounds(g.roots.map(visualBox));
      if (box) {
        const result = snapTranslation(
          box,
          this.candidates(g),
          Math.round(dx),
          Math.round(dy),
          s.zoom,
          s.snappingEnabled && !modifiers.disableSnap,
          s.gridSnappingEnabled && !modifiers.disableSnap ? s.snapGridSize : undefined,
        );
        if (g.moveAxis === 'x') result.dy = 0;
        if (g.moveAxis === 'y') result.dx = 0;
        if (g.moveAxis) {
          result.guides = result.guides.filter((guide) => guide.axis === g.moveAxis);
          result.measurements = [];
        }
        translateNodes(s.doc, g.nodes, result.dx, result.dy);
        this.guides = result.guides;
        this.measurements = result.measurements;
      }
    } else if (g.kind === 'rotate') {
      let delta = normalizeAngle(angleAt(point, g.pivot) - g.startAngle);
      if (modifiers.aspect)
        delta = Math.round((g.initialRotation + delta) / 15) * 15 - g.initialRotation;
      rotateNodes(s.doc, g.nodes, g.pivot, delta);
    } else if (g.kind === 'resize') {
      let world = point;
      if (
        !g.angle &&
        (s.snappingEnabled || s.gridSnappingEnabled) &&
        !modifiers.disableSnap &&
        !modifiers.aspect &&
        !modifiers.center
      ) {
        const anchor = {
          x: g.handle.includes('e')
            ? g.bounds.x + g.bounds.width
            : g.handle.includes('w')
              ? g.bounds.x
              : g.pivot.x,
          y: g.handle.includes('s')
            ? g.bounds.y + g.bounds.height
            : g.handle.includes('n')
              ? g.bounds.y
              : g.pivot.y,
        };
        const movingAnchor = {
          x: anchor.x + point.x - g.start.x,
          y: anchor.y + point.y - g.start.y,
        };
        const snapped = s.snappingEnabled
          ? snapPoint(movingAnchor, this.candidates(g), s.zoom)
          : { point: movingAnchor, guides: [] };
        const aligned =
          s.gridSnappingEnabled && !modifiers.disableSnap
            ? snapToGrid(snapped.point, s.snapGridSize, s.zoom).point
            : snapped.point;
        world = {
          x: point.x + aligned.x - movingAnchor.x,
          y: point.y + aligned.y - movingAnchor.y,
        };
        this.guides = snapped.guides.filter((guide) =>
          guide.axis === 'x'
            ? g.handle.includes('e') || g.handle.includes('w')
            : g.handle.includes('n') || g.handle.includes('s'),
        );
      }
      const p = rotatePoint(world, g.pivot, -g.angle),
        frameOnly = g.roots.length === 1 && g.roots[0].type === 'frame';
      const minWidth = frameOnly ? 1 : Math.max(...g.nodes.map((n) => g.bounds.width / n.width)),
        minHeight = frameOnly ? 1 : Math.max(...g.nodes.map((n) => g.bounds.height / n.height));
      const next = resizeBox(g.bounds, g.handle, p.x - g.start.x, p.y - g.start.y, {
        ...modifiers,
        minWidth,
        minHeight,
      });
      if (frameOnly) {
        const c = rotatePoint(center(next), g.pivot, g.angle);
        resizeFrame(s.doc, g.before, g.roots[0].id, {
          ...next,
          x: c.x - next.width / 2,
          y: c.y - next.height / 2,
        });
      } else resizeOrientedNodes(s.doc, g.nodes, g.bounds, next, g.pivot, g.angle);
    } else if (g.kind === 'marquee') {
      g.box = boxBetween(g.start, point);
      s.selected = new Set([
        ...g.base,
        ...marqueeIds(
          s.doc.nodes
            .filter(
              (n) =>
                !isLocked(s.doc, n) &&
                !isHidden(s.doc, n) &&
                (g.nested
                  ? n.parentId !== null && n.type !== 'frame' && n.type !== 'group'
                  : n.parentId === null),
            )
            .flatMap((n) => {
              const box = clippedVisualBox(s.doc, n);
              return box ? [{ ...n, ...box }] : [];
            }),
          g.box,
        ),
      ]);
    } else if (g.kind === 'draw') {
      const n = s.current();
      let end = point;
      if (n && !modifiers.perfect && s.snappingEnabled && !modifiers.disableSnap) {
        const result = snapPoint(point, this.candidates(g), s.zoom);
        end = result.point;
        this.guides = result.guides;
      }
      if (n && s.gridSnappingEnabled && !modifiers.disableSnap)
        end = snapToGrid(end, s.snapGridSize, s.zoom).point;
      if (n && (g.shape === 'line' || g.shape === 'arrow'))
        (g.shape === 'arrow' ? applyArrow : applyLine)(
          n,
          g.start,
          modifiers.aspect ? snapLineAngle(g.start, end) : end,
        );
      else if (n)
        Object.assign(
          n,
          drawingBox(
            g.start,
            end,
            modifiers.perfect === true && (s.tool === 'rectangle' || s.tool === 'ellipse'),
          ),
        );
    }
    s.refresh('scene');
  }
  finish(): void {
    const g = this.active;
    if (!g) return;
    this.active = null;
    this.guides = [];
    this.measurements = [];
    if (g.kind === 'draw') this.store.tool = 'select';
    if (g.kind === 'pan' || g.kind === 'marquee') this.store.refresh();
    else {
      try {
        if (
          g.kind === 'move' &&
          g.deselectOnClick &&
          JSON.stringify(g.before) === JSON.stringify(this.store.doc)
        )
          this.store.selected.delete(g.deselectOnClick);
        if (
          JSON.stringify(g.before) !== JSON.stringify(this.store.doc) &&
          (g.kind === 'move' || g.kind === 'draw')
        ) {
          reparentSelection(
            this.store.doc,
            new Set(editableNodes(this.store.doc, this.store.selected).map((n) => n.id)),
          );
          if (g.kind === 'draw') {
            const n = this.store.current();
            if (n) adoptEnclosed(this.store.doc, n);
          }
        }
        this.store.commit(g.before);
      } catch (error) {
        this.store.doc = g.before;
        this.store.selected = g.selection;
        this.store.refresh();
        throw error;
      }
    }
  }
  cancel(): boolean {
    const g = this.active;
    if (!g) return false;
    this.active = null;
    this.guides = [];
    this.measurements = [];
    this.store.doc = g.before;
    this.store.selected = g.selection;
    if (g.kind === 'pan') this.store.pan = g.pan;
    this.store.refresh();
    return true;
  }
}
