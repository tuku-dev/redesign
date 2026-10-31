import type { EditorStore } from '../editor/store.ts';
import { ensureWorkspace } from '../model/workspace.ts';
export class GuideCommands {
  constructor(private readonly store: EditorStore) {}
  rulers(): void {
    this.store.change(() => {
      const w = ensureWorkspace(this.store.doc);
      w.rulers = !w.rulers;
    });
  }
  toggle(): void {
    this.store.change(() => {
      const w = ensureWorkspace(this.store.doc);
      w.guidesVisible = !w.guidesVisible;
    });
  }
  add(axis: 'x' | 'y', position: number): string {
    const id = crypto.randomUUID();
    this.store.change(() => ensureWorkspace(this.store.doc).guides.push({ id, axis, position }));
    return id;
  }
  move(id: string, position: number): void {
    this.store.change(() => {
      const g = ensureWorkspace(this.store.doc).guides.find((g) => g.id === id);
      if (g) g.position = position;
    });
  }
  remove(id: string): void {
    this.store.change(() => {
      const w = ensureWorkspace(this.store.doc);
      w.guides = w.guides.filter((g) => g.id !== id);
    });
  }
}
