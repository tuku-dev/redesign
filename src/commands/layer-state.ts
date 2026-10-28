import type { EditorStore } from '../editor/store.ts';
import { selectionRoots } from '../model/hierarchy.ts';
export class LayerStateCommands {
  constructor(private readonly store: EditorStore) {}
  toggle(key: 'locked' | 'hidden'): void {
    const s = this.store,
      nodes = selectionRoots(s.doc, s.selected);
    if (!nodes.length) return;
    const value = !nodes.every((n) => n[key]);
    s.change(() => nodes.forEach((n) => (n[key] = value)));
  }
  setFor(id: string, key: 'locked' | 'hidden'): void {
    const s = this.store,
      n = s.doc.nodes.find((n) => n.id === id);
    if (n) s.change(() => (n[key] = !n[key]));
  }
  revealAll(): void {
    const s = this.store;
    s.change(() => s.doc.nodes.forEach((n) => (n.hidden = false)));
  }
  unlockAll(): void {
    const s = this.store;
    s.change(() => s.doc.nodes.forEach((n) => (n.locked = false)));
  }
}
