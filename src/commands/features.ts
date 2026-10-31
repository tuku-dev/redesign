import { moveAnchor, moveHandle, pointKind } from '../model/bezier.ts';
import type { VectorPoint } from '../model/features.ts';
import type { EditorStore } from '../editor/store.ts';
import type { DesignNode, Point } from '../model/types.ts';
import type {
  AutoLayout,
  Appearance,
  ImageAdjustments,
  ImageFill,
  LayoutGrid,
  Sizing,
} from '../model/features.ts';
import { defaultLayout, isRasterData } from '../model/features.ts';
import { createNode } from '../model/document.ts';
import { descendants, selectionRoots, containingFrame } from '../model/hierarchy.ts';
import { isLocked } from '../model/layer-state.ts';
import { clone } from '../model/types.ts';
import { cloneNodes } from './transforms.ts';
import { allNodes } from '../model/workspace.ts';
import { visualBox } from '../model/rotation.ts';
import { bounds } from '../model/geometry.ts';
import { detachInstance } from '../model/components.ts';
import { booleanRings, vectorFromPoints } from '../model/vector.ts';
import { LINE_STROKE, linePoints, polygonPoints, starPoints } from '../model/shapes.ts';
import type { ShapeKind } from '../model/shapes.ts';
import type { BooleanOperation } from '../model/vector.ts';
export class FeatureCommands {
  constructor(private readonly store: EditorStore) {}
  private editable(): DesignNode[] {
    return this.store.chosen().filter((n) => !isLocked(this.store.doc, n));
  }
  layout(value: AutoLayout | undefined): void {
    const roots = selectionRoots(this.store.doc, this.store.selected);
    if (!roots.length || roots.some((n) => isLocked(this.store.doc, n))) return;
    // Wrap and configure in a single undo transaction.
    this.store.change(() => {
      if (roots.length !== 1 || roots[0].type !== 'frame') {
        const s = this.store;
        const x = Math.min(...roots.map((n) => n.x)),
          y = Math.min(...roots.map((n) => n.y));
        const width = Math.max(...roots.map((n) => n.x + n.width)) - x,
          height = Math.max(...roots.map((n) => n.y + n.height)) - y;
        const frame = createNode('frame', {
          x,
          y,
          width,
          height,
          parentId: roots.every((n) => n.parentId === roots[0].parentId) ? roots[0].parentId : null,
        });
        s.doc.nodes.push(frame);
        roots.forEach((n) => (n.parentId = frame.id));
        s.selected = new Set([frame.id]);
      }
      const n = this.store.current()!;
      if (value) {
        n.layout = clone(value);
        n.sizing ??= { width: 'hug', height: 'hug' };
      } else delete n.layout;
    });
  }
  addLayout(): void {
    this.layout(defaultLayout());
  }
  sizing(value: Sizing): void {
    this.store.change(() => this.editable().forEach((n) => (n.sizing = clone(value))));
  }
  appearance(value: Appearance): void {
    this.store.change(() =>
      this.editable()
        .filter((n) => n.type !== 'group')
        .forEach((n) => (n.appearance = clone(value))),
    );
  }
  grid(value: LayoutGrid | undefined): void {
    this.store.change(() =>
      this.editable()
        .filter((n) => n.type === 'frame')
        .forEach((n) => {
          if (value) n.layoutGrid = clone(value);
          else delete n.layoutGrid;
        }),
    );
  }
  image(value: ImageFill): void {
    if (!isRasterData(value.src)) throw new Error('Choose a PNG, JPEG, WebP or GIF image.');
    this.store.change(() =>
      this.editable()
        .filter((n) => n.type === 'rectangle' || n.type === 'ellipse' || n.type === 'frame')
        .forEach((n) => (n.image = clone(value))),
    );
  }
  imageAdjustments(value: ImageAdjustments): void {
    if (
      ![value.brightness, value.contrast, value.saturation].every(
        (v) => Number.isFinite(v) && v >= 0 && v <= 200,
      )
    )
      throw new Error('Image adjustments must be between 0 and 200.');
    this.store.change(() =>
      this.editable().forEach((n) => {
        if (n.image) n.image.adjustments = clone(value);
      }),
    );
  }
  insertImage(image: ImageFill, size: { width: number; height: number }, point: Point): void {
    this.store.change(() => {
      const n = createNode('rectangle', {
        ...point,
        width: size.width,
        height: size.height,
        image: clone(image),
        name: 'Image',
      });
      n.parentId = containingFrame(this.store.doc, n)?.id ?? null;
      this.store.doc.nodes.push(n);
      this.store.selected = new Set([n.id]);
    });
  }
  createComponent(): void {
    const roots = selectionRoots(this.store.doc, this.store.selected);
    if (!roots.length || roots.some((n) => isLocked(this.store.doc, n))) return;
    if (
      descendants(this.store.doc, new Set(roots.map((n) => n.id))).some(
        (n) => n.component || n.instanceSource,
      )
    )
      throw new Error('Detach nested instances before creating a component.');
    this.store.change(() => {
      let root = roots[0];
      if (roots.length !== 1 || root.type !== 'frame') {
        const box = bounds(roots.map(visualBox))!;
        root = createNode('frame', {
          ...box,
          parentId: roots.every((n) => n.parentId === roots[0].parentId) ? roots[0].parentId : null,
          name: 'Component',
        });
        this.store.doc.nodes.push(root);
        roots.forEach((n) => (n.parentId = root.id));
      }
      root.component = { kind: 'main' };
      this.store.selected = new Set([root.id]);
    });
  }
  instantiate(sourceId?: string): void {
    const s = this.store;
    const source = allNodes(s.doc).find(
      (n) => n.id === (sourceId ?? s.current()?.id) && n.component?.kind === 'main',
    );
    if (!source) throw new Error('Select a main component first.');
    s.change(() => {
      const sourceNodes = s.doc.nodes.includes(source)
        ? s.doc.nodes
        : s.doc.workspace!.pages.find((p) => p.nodes.includes(source))!.nodes;
      const originals = descendants({ ...s.doc, nodes: sourceNodes }, new Set([source.id])),
        copies = cloneNodes(originals, 40, 40);
      originals.forEach((n, i) => {
        copies[i].instanceSource = n.id;
        copies[i].overrides = [];
        delete copies[i].component;
      });
      const root = copies[originals.indexOf(source)];
      root.component = { kind: 'instance', sourceId: source.id };
      root.parentId = null;
      root.locked = false;
      root.hidden = false;
      root.name = source.name + ' instance';
      root.overrides = ['name'];
      s.doc.nodes.push(...copies);
      s.selected = new Set([root.id]);
    });
  }
  resetInstance(): void {
    const root = this.store.current();
    if (root?.component?.kind !== 'instance' || isLocked(this.store.doc, root)) return;
    this.store.change(() =>
      descendants(this.store.doc, new Set([root.id])).forEach((n) => (n.overrides = [])),
    );
  }
  detach(): void {
    const root = this.store.current();
    if (root?.component?.kind !== 'instance' || isLocked(this.store.doc, root)) return;
    this.store.change(() => detachInstance(this.store.doc, root));
  }
  prototype(targetId: string, transition: 'instant' | 'dissolve', duration: number): void {
    this.store.change(() =>
      this.editable().forEach((n) => {
        if (targetId) n.prototype = { targetId, transition, duration };
        else delete n.prototype;
      }),
    );
  }
  /** Inserts a line, regular polygon or star as an editable vector path centered on a point. */
  shape(kind: ShapeKind, center: Point, count = 5): void {
    const points =
      kind === 'line'
        ? linePoints(center, 200)
        : kind === 'polygon'
          ? polygonPoints(center, 80, count)
          : starPoints(center, 80, count);
    this.path(
      points,
      kind !== 'line',
      kind[0]!.toUpperCase() + kind.slice(1),
      kind === 'line' ? LINE_STROKE : undefined,
    );
  }
  path(points: VectorPoint[], closed: boolean, name = 'Vector', stroke = '#1e1e1e'): void {
    const s = this.store;
    s.change(() => {
      const n = createNode('path', {
        ...vectorFromPoints([points], closed),
        name,
        appearance: {
          stroke,
          strokeWidth: closed ? 0 : 2,
          gradient: { enabled: false, end: '#0d99ff', angle: 90 },
          shadow: { enabled: false, x: 0, y: 4, blur: 8, color: '#000000', opacity: 0.25 },
          blur: 0,
        },
      });
      n.parentId = containingFrame(s.doc, n)?.id ?? null;
      s.doc.nodes.push(n);
      s.selected = new Set([n.id]);
    });
  }
  /** Converts a rectangle or ellipse into an editable closed path in place; returns false if not applicable. */
  toVector(id: string): boolean {
    const n = this.store.doc.nodes.find((node) => node.id === id);
    if (
      !n ||
      n.vector ||
      (n.type !== 'rectangle' && n.type !== 'ellipse') ||
      isLocked(this.store.doc, n)
    )
      return false;
    const k = 0.5522847498 / 2;
    const rings: VectorPoint[][] =
      n.type === 'ellipse'
        ? [
            [
              { x: 0.5, y: 0, smooth: true, in: { x: 0.5 - k, y: 0 }, out: { x: 0.5 + k, y: 0 } },
              { x: 1, y: 0.5, smooth: true, in: { x: 1, y: 0.5 - k }, out: { x: 1, y: 0.5 + k } },
              { x: 0.5, y: 1, smooth: true, in: { x: 0.5 + k, y: 1 }, out: { x: 0.5 - k, y: 1 } },
              { x: 0, y: 0.5, smooth: true, in: { x: 0, y: 0.5 + k }, out: { x: 0, y: 0.5 - k } },
            ],
          ]
        : [
            [
              { x: 0, y: 0, radius: n.cornerRadii?.topLeft },
              { x: 1, y: 0, radius: n.cornerRadii?.topRight },
              { x: 1, y: 1, radius: n.cornerRadii?.bottomRight },
              { x: 0, y: 1, radius: n.cornerRadii?.bottomLeft },
            ].map((p) => (p.radius === undefined ? { x: p.x, y: p.y } : p)),
          ];
    this.store.change(() => {
      n.type = 'path';
      n.vector = { closed: true, rings };
      delete n.cornerRadii;
      if (n.name === 'Rectangle' || n.name === 'Ellipse') n.name = 'Vector';
    });
    return true;
  }
  vertex(ring: number, index: number, point: Point): void {
    const n = this.store.current();
    if (n?.type !== 'path' || !n.vector || isLocked(this.store.doc, n)) return;
    this.store.change(() => {
      const p = n.vector?.rings[ring]?.[index];
      if (!p) throw new Error('Unknown vector point.');
      moveAnchor(p, point);
    });
  }
  handle(ring: number, index: number, side: 'in' | 'out', point: Point, independent = false): void {
    const n = this.store.current();
    if (!n?.vector || isLocked(this.store.doc, n)) return;
    this.store.change(() => {
      const p = n.vector!.rings[ring]?.[index];
      if (!p) throw new Error('Unknown vector point.');
      moveHandle(p, side, point, independent, { x: n.width, y: n.height });
    });
  }
  pointKind(ring: number, index: number, smooth: boolean): void {
    const n = this.store.current();
    if (!n?.vector || isLocked(this.store.doc, n)) return;
    this.store.change(() => pointKind(n.vector!.rings[ring], index, smooth, n.vector!.closed));
  }
  boolean(operation: BooleanOperation): void {
    const s = this.store,
      roots = selectionRoots(s.doc, s.selected);
    if (roots.some((n) => isLocked(s.doc, n))) throw new Error('Unlock the selected shapes first.');
    if (roots.some((n) => n.image || n.type === 'frame' || n.type === 'group' || n.type === 'text'))
      throw new Error('Choose closed vector shapes without image fills.');
    const rings = booleanRings(roots, operation);
    s.change(() => {
      const ids = new Set(roots.map((n) => n.id)),
        index = Math.max(...roots.map((n) => s.doc.nodes.indexOf(n)));
      const n = rings.length
        ? createNode('path', {
            ...vectorFromPoints(rings),
            name: operation,
            fill: roots[0].fill,
            appearance: clone(roots[0].appearance),
            parentId: roots.every((n) => n.parentId === roots[0].parentId)
              ? roots[0].parentId
              : null,
          })
        : null;
      if (n) s.doc.nodes.splice(index, 0, n);
      s.doc.nodes = s.doc.nodes.filter((n) => !ids.has(n.id));
      s.selected = new Set(n ? [n.id] : []);
    });
  }
}
