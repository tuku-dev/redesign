import { resizeFrame } from '../model/constraints.ts';
import { editableNodes, isLocked } from '../model/layer-state.ts';
import {
  descendants,
  selectionRoots,
  containingFrame,
  assertHierarchy,
} from '../model/hierarchy.ts';
import { createNode, validateDocument } from '../model/document.ts';
import { clone } from '../model/types.ts';
import type { Alignment, Axis, EditableProperty } from '../model/types.ts';
import { selectedNodes } from '../model/selection.ts';
import { bounds, cornerRadii } from '../model/geometry.ts';
import { center, visualBox } from '../model/rotation.ts';
import type { EditorStore } from '../editor/store.ts';
import { cloneNodes, translateNodes } from './transforms.ts';
import { flipNodes, rotateNodes } from './rotation.ts';
import { alignNodes, distributeAlignedNodes, distributeNodes } from './alignment.ts';
export class EditingCommands {
  constructor(private readonly store: EditorStore) {}
  addRectangle(): void {
    const s = this.store;
    s.change(() => {
      const n = createNode('rectangle', { x: 100, y: 100 });
      n.parentId = containingFrame(s.doc, n)?.id ?? null;
      s.doc.nodes.push(n);
      s.selected = new Set([n.id]);
    });
  }
  duplicate(): void {
    const s = this.store;
    if (!s.selected.size || s.chosen().some((n) => isLocked(s.doc, n))) return;
    s.change(() => {
      const roots = selectionRoots(s.doc, s.selected),
        originals = descendants(s.doc, s.selected),
        copies = cloneNodes(originals);
      const rootIds = new Set(roots.map((n) => n.id));
      copies.forEach((n) => (n.name += ' copy'));
      s.doc.nodes.push(...copies);
      s.selected = new Set(copies.filter((_, i) => rootIds.has(originals[i].id)).map((n) => n.id));
    });
  }
  remove(): void {
    const s = this.store;
    if (!s.selected.size) return;
    s.change(() => {
      const removed = new Set(
        descendants(s.doc, new Set(editableNodes(s.doc, s.selected).map((n) => n.id))).map(
          (n) => n.id,
        ),
      );
      s.doc.nodes = s.doc.nodes.filter((n) => !removed.has(n.id));
      s.selected.clear();
    });
  }
  nudge(dx: number, dy: number): void {
    const s = this.store;
    if (!s.selected.size) return;
    const originals = clone(
      descendants(s.doc, new Set(editableNodes(s.doc, s.selected).map((n) => n.id))),
    );
    s.change(() => translateNodes(s.doc, originals, dx, dy));
  }
  setProperty(key: EditableProperty, value: string | number): void {
    const s = this.store,
      next = clone(s.doc);
    if (s.chosen().some((n) => isLocked(s.doc, n))) return;
    const beforeResize = clone(next);
    const targets =
      key === 'x' || key === 'y' || key === 'width' || key === 'height'
        ? selectionRoots(next, s.selected)
        : selectedNodes(next, s.selected);
    for (const n of targets) {
      if (
        n.type === 'frame' &&
        (key === 'width' || key === 'height') &&
        typeof value === 'number'
      ) {
        resizeFrame(next, beforeResize, n.id, {
          x: n.x,
          y: n.y,
          width: key === 'width' ? value : n.width,
          height: key === 'height' ? value : n.height,
        });
        continue;
      }
      if ((key === 'x' || key === 'y') && typeof value === 'number') {
        const dx = key === 'x' ? value - n.x : 0,
          dy = key === 'y' ? value - n.y : 0;
        translateNodes(next, clone(descendants(next, new Set([n.id]))), dx, dy);
        continue;
      }
      if (key === 'name' || key === 'fill') {
        if (typeof value !== 'string') throw new Error('Expected text value.');
        n[key] = value;
        if (key === 'fill' && n.appearance?.fills?.length) n.appearance.fills[0]!.color = value;
      } else {
        if (typeof value !== 'number') throw new Error('Expected numeric value.');
        if (key === 'radius') {
          n.radius = value;
          delete n.cornerRadii;
          n.vector?.rings.forEach((ring) => ring.forEach((p) => delete p.radius));
        } else if (key === 'topLeftRadius') {
          n.cornerRadii = { ...cornerRadii(n), topLeft: value };
        } else if (key === 'topRightRadius') {
          n.cornerRadii = { ...cornerRadii(n), topRight: value };
        } else if (key === 'bottomRightRadius') {
          n.cornerRadii = { ...cornerRadii(n), bottomRight: value };
        } else if (key === 'bottomLeftRadius') {
          n.cornerRadii = { ...cornerRadii(n), bottomLeft: value };
        } else Object.assign(n, { [key]: value });
      }
    }
    validateDocument(next);
    s.change(() => (s.doc = next));
  }
  setParent(parentId: string | null): void {
    const s = this.store;
    if (s.chosen().some((n) => isLocked(s.doc, n))) return;
    s.change(() => {
      const roots = selectionRoots(s.doc, s.selected);
      for (const n of roots) n.parentId = parentId;
      assertHierarchy(s.doc.nodes);
    });
  }
  setText(text: string): void {
    const n = this.store.current();
    if (n && !isLocked(this.store.doc, n)) this.store.change(() => (n.text = text));
  }
  reorder(direction: 1 | -1): void {
    const s = this.store,
      n = s.current();
    if (!n || s.selected.size !== 1 || isLocked(s.doc, n)) return;
    s.change(() => {
      const siblings = s.doc.nodes.filter((item) => item.parentId === n.parentId),
        index = siblings.indexOf(n),
        other = siblings[index + direction];
      if (other) {
        const i = s.doc.nodes.indexOf(n),
          j = s.doc.nodes.indexOf(other);
        [s.doc.nodes[i], s.doc.nodes[j]] = [s.doc.nodes[j], s.doc.nodes[i]];
      }
    });
  }
  align(mode: Alignment): void {
    const s = this.store;
    s.change(() => alignNodes(s.doc, s.selected, mode));
  }
  distribute(axis: Axis): void {
    const s = this.store;
    s.change(() => distributeNodes(s.doc, s.selected, axis));
  }
  rotate(degrees: number): void {
    const s = this.store;
    if (!s.selected.size || s.chosen().some((n) => isLocked(s.doc, n))) return;
    const roots = selectionRoots(s.doc, s.selected),
      originals = clone(descendants(s.doc, new Set(roots.map((n) => n.id)))),
      box = bounds(roots.map(visualBox));
    if (!box) return;
    s.change(() => rotateNodes(s.doc, originals, center(box), degrees));
  }
  flip(axis: 'horizontal' | 'vertical'): void {
    const s = this.store;
    if (!s.selected.size || s.chosen().some((n) => isLocked(s.doc, n))) return;
    const roots = selectionRoots(s.doc, s.selected),
      originals = clone(descendants(s.doc, new Set(roots.map((n) => n.id)))),
      box = bounds(roots.map(visualBox));
    if (!box) return;
    s.change(() => flipNodes(s.doc, originals, center(box), axis));
  }
  distributeAligned(mode: Alignment): void {
    const s = this.store;
    s.change(() => distributeAlignedNodes(s.doc, s.selected, mode));
  }
}
