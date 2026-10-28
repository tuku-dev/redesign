import { descendants, selectionRoots } from '../model/hierarchy.ts';
import { clone } from '../model/types.ts';
import type { NodeOptions } from '../model/types.ts';
import { validateDocument } from '../model/document.ts';
import { isLocked } from '../model/layer-state.ts';
import { center } from '../model/rotation.ts';
import { rotateNodes } from './rotation.ts';
import type { EditorStore } from '../editor/store.ts';
export class NodeOptionCommands {
  constructor(private readonly store: EditorStore) {}
  set<K extends keyof NodeOptions>(key: K, value: NodeOptions[K]): void {
    const s = this.store;
    if (s.chosen().some((n) => isLocked(s.doc, n))) return;
    const next = clone(s.doc),
      nodes =
        key === 'rotation'
          ? selectionRoots(next, s.selected)
          : next.nodes.filter((n) => s.selected.has(n.id));
    for (const n of nodes) {
      if (key === 'rotation' && typeof value === 'number')
        rotateNodes(next, clone(descendants(next, new Set([n.id]))), center(n), value - n.rotation);
      else Object.assign(n, { [key]: value });
    }
    validateDocument(next);
    s.change(() => (s.doc = next));
  }
}
