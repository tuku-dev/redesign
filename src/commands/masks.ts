import { createNode } from '../model/document.ts';
import { bounds } from '../model/geometry.ts';
import { visualBox } from '../model/rotation.ts';
import { selectionRoots } from '../model/hierarchy.ts';
import { isLocked } from '../model/layer-state.ts';
import { canMask } from '../model/masks.ts';
import type { EditorStore } from '../editor/store.ts';
export class MaskCommands {
  constructor(private readonly store: EditorStore) {}
  create(): void {
    const s = this.store,
      roots = selectionRoots(s.doc, s.selected);
    if (roots.length < 2) throw Error('Select a bottom mask shape and the artwork above it.');
    if (roots.some((n) => isLocked(s.doc, n))) throw Error('Unlock the selected layers first.');
    if (!canMask(roots[0]))
      throw Error('The bottom layer must be a rectangle, ellipse or closed path.');
    if (roots.some((n) => n.parentId !== roots[0].parentId))
      throw Error('Mask layers must share the same parent.');
    const box = bounds(roots.map(visualBox))!;
    s.change(() => {
      const group = createNode('group', {
        ...box,
        name: 'Outline mask',
        parentId: roots[0].parentId,
        maskId: roots[0].id,
      });
      s.doc.nodes.splice(s.doc.nodes.indexOf(roots[0]), 0, group);
      roots.forEach((n) => (n.parentId = group.id));
      s.selected = new Set([group.id]);
    });
  }
  release(): void {
    const n = this.store.current();
    if (!n?.maskId || isLocked(this.store.doc, n)) return;
    this.store.change(() => {
      delete n.maskId;
    });
  }
}
