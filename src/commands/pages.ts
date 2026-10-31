import type { EditorStore } from '../editor/store.ts';
import { clone } from '../model/types.ts';
import { ensureWorkspace } from '../model/workspace.ts';
import { cloneNodes } from './transforms.ts';
export class PageCommands {
  constructor(private readonly store: EditorStore) {}
  switch(id: string): void {
    const s = this.store,
      w = s.doc.workspace;
    if (!w || id === w.activePageId || !w.pages.some((p) => p.id === id)) return;
    s.change(() => {
      w.pages.find((p) => p.id === w.activePageId)!.nodes = s.doc.nodes;
      const next = w.pages.find((p) => p.id === id)!;
      s.doc.nodes = next.nodes;
      next.nodes = [];
      w.activePageId = id;
      s.selected.clear();
      s.editingTextId = null;
    });
  }
  add(): void {
    this.store.change(() => {
      const s = this.store,
        w = ensureWorkspace(s.doc);
      w.pages.find((p) => p.id === w.activePageId)!.nodes = s.doc.nodes;
      const id = crypto.randomUUID();
      w.pages.push({ id, name: `Page ${w.pages.length + 1}`, nodes: [] });
      w.activePageId = id;
      s.doc.nodes = [];
      s.selected.clear();
      s.editingTextId = null;
    });
  }
  rename(name: string): void {
    if (!name.trim()) throw new Error('Page name cannot be empty.');
    this.store.change(() => {
      const w = ensureWorkspace(this.store.doc);
      w.pages.find((p) => p.id === w.activePageId)!.name = name.trim();
    });
  }
  duplicate(): void {
    this.store.change(() => {
      const s = this.store,
        w = ensureWorkspace(s.doc),
        current = w.pages.find((p) => p.id === w.activePageId)!;
      const copied = cloneNodes(clone(s.doc.nodes), 0, 0),
        ids = new Map(s.doc.nodes.map((n, i) => [n.id, copied[i].id]));
      for (const n of copied) {
        if (n.prototype && ids.has(n.prototype.targetId))
          n.prototype.targetId = ids.get(n.prototype.targetId)!;
        if (n.component?.sourceId && ids.has(n.component.sourceId))
          n.component.sourceId = ids.get(n.component.sourceId)!;
        if (n.instanceSource && ids.has(n.instanceSource))
          n.instanceSource = ids.get(n.instanceSource)!;
      }
      current.nodes = s.doc.nodes;
      const next = { id: crypto.randomUUID(), name: current.name + ' copy', nodes: [] };
      w.pages.splice(w.pages.indexOf(current) + 1, 0, next);
      w.activePageId = next.id;
      s.doc.nodes = copied;
      s.selected.clear();
    });
  }
  remove(): void {
    const s = this.store,
      w = s.doc.workspace;
    if (!w || w.pages.length === 1) throw new Error('Keep at least one page.');
    s.change(() => {
      const index = w.pages.findIndex((p) => p.id === w.activePageId);
      w.pages.splice(index, 1);
      const next = w.pages[Math.min(index, w.pages.length - 1)];
      s.doc.nodes = next.nodes;
      next.nodes = [];
      w.activePageId = next.id;
      s.selected.clear();
    });
  }
  reorder(delta: number): void {
    const s = this.store,
      w = s.doc.workspace;
    if (!w) return;
    const index = w.pages.findIndex((p) => p.id === w.activePageId),
      next = index + delta;
    if (next < 0 || next >= w.pages.length) return;
    s.change(() => {
      const [p] = w.pages.splice(index, 1);
      w.pages.splice(next, 0, p);
    });
  }
}
