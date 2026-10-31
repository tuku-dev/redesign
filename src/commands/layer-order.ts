import type { EditorStore } from '../editor/store.ts';
import { selectionRoots } from '../model/hierarchy.ts';
import { isLocked } from '../model/layer-state.ts';
export type OrderAction = 'forward' | 'backward' | 'front' | 'back';
export class LayerOrderCommands {
  constructor(private readonly store: EditorStore) {}
  canReorderRelative(ids: ReadonlySet<string>, targetId: string): boolean {
    const roots = selectionRoots(this.store.doc, ids),
      target = this.store.doc.nodes.find((n) => n.id === targetId);
    return !!(
      target &&
      roots.length &&
      !roots.some((n) => isLocked(this.store.doc, n)) &&
      roots.every((n) => n.parentId === target.parentId) &&
      !roots.some((n) => n.id === targetId)
    );
  }
  reorderRelative(ids: ReadonlySet<string>, targetId: string, after: boolean): void {
    if (!this.canReorderRelative(ids, targetId)) return;
    const s = this.store,
      roots = selectionRoots(s.doc, ids),
      moved = new Set(roots.map((n) => n.id)),
      target = s.doc.nodes.find((n) => n.id === targetId)!;
    s.change(() => {
      const indices = s.doc.nodes
          .map((n, index) => (n.parentId === target.parentId ? index : -1))
          .filter((index) => index >= 0),
        visualOrder = indices.map((index) => s.doc.nodes[index]).reverse(),
        moving = visualOrder.filter((n) => moved.has(n.id)),
        remaining = visualOrder.filter((n) => !moved.has(n.id)),
        targetIndex = remaining.findIndex((n) => n.id === targetId);
      remaining.splice(targetIndex + (after ? 1 : 0), 0, ...moving);
      remaining.reverse().forEach((node, index) => (s.doc.nodes[indices[index]] = node));
    });
  }
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
