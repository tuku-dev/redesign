import { visualBox } from '../model/rotation.ts';
import { createNode } from '../model/document.ts';
import { bounds } from '../model/geometry.ts';
import { selectionRoots } from '../model/hierarchy.ts';
import { isLocked } from '../model/layer-state.ts';
import type { EditorStore } from '../editor/store.ts';
export class StructureCommands {
  constructor(private readonly store: EditorStore) {}
  wrap(type: 'frame' | 'group'): void {
    const s = this.store,
      roots = selectionRoots(s.doc, s.selected);
    if (!roots.length || roots.some((n) => isLocked(s.doc, n))) return;
    const box = bounds(roots.map(visualBox));
    if (!box) return;
    const parentId = roots.every((n) => n.parentId === roots[0].parentId)
      ? roots[0].parentId
      : null;
    s.change(() => {
      const wrapper = createNode(type, {
        ...box,
        parentId,
        name: type === 'group' ? 'Group' : 'Frame',
      });
      const index = Math.max(...roots.map((n) => s.doc.nodes.indexOf(n)));
      s.doc.nodes.splice(index, 0, wrapper);
      roots.forEach((n) => (n.parentId = wrapper.id));
      s.selected = new Set([wrapper.id]);
    });
  }
  unwrap(): void {
    const s = this.store,
      roots = selectionRoots(s.doc, s.selected).filter(
        (n) => n.type === 'group' || n.type === 'frame',
      );
    if (!roots.length || roots.some((n) => isLocked(s.doc, n))) return;
    s.change(() => {
      const children = new Map(
        roots.map((parent) => [parent.id, s.doc.nodes.filter((n) => n.parentId === parent.id)]),
      );
      const lifted = new Set<string>();
      for (const parent of roots)
        for (const child of children.get(parent.id) ?? []) {
          child.parentId = parent.parentId;
          lifted.add(child.id);
        }
      const remove = new Set(roots.map((n) => n.id));
      s.doc.nodes = s.doc.nodes.flatMap((n) =>
        remove.has(n.id) ? (children.get(n.id) ?? []) : lifted.has(n.id) ? [] : [n],
      );
      s.selected = lifted;
    });
  }
}
