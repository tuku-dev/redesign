import type { EditorStore } from '../editor/store.ts';
import { selectionRoots } from '../model/hierarchy.ts';
import { isLocked } from '../model/layer-state.ts';
export type OrderAction = 'forward' | 'backward' | 'front' | 'back';
export class LayerOrderCommands {
  constructor(private readonly store: EditorStore) {}
  order(action: OrderAction): void {
    const s = this.store,
      roots = selectionRoots(s.doc, s.selected);
    if (!roots.length || roots.some((n) => isLocked(s.doc, n))) return;
    const ids = new Set(roots.map((n) => n.id));
    s.change(() => {
      const parents = new Set(roots.map((n) => n.parentId));
      for (const parent of parents) {
        const indices = s.doc.nodes
          .map((n, i) => (n.parentId === parent ? i : -1))
          .filter((i) => i >= 0);
        let siblings = indices.map((i) => s.doc.nodes[i]);
        if (action === 'front')
          siblings = [
            ...siblings.filter((n) => !ids.has(n.id)),
            ...siblings.filter((n) => ids.has(n.id)),
          ];
        else if (action === 'back')
          siblings = [
            ...siblings.filter((n) => ids.has(n.id)),
            ...siblings.filter((n) => !ids.has(n.id)),
          ];
        else if (action === 'forward') {
          for (let i = siblings.length - 2; i >= 0; i--)
            if (ids.has(siblings[i].id) && !ids.has(siblings[i + 1].id))
              [siblings[i], siblings[i + 1]] = [siblings[i + 1], siblings[i]];
        } else
          for (let i = 1; i < siblings.length; i++)
            if (ids.has(siblings[i].id) && !ids.has(siblings[i - 1].id))
              [siblings[i], siblings[i - 1]] = [siblings[i - 1], siblings[i]];
        indices.forEach((index, i) => (s.doc.nodes[index] = siblings[i]));
      }
    });
  }
}
