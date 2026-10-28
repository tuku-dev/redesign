import { isLocked, isHidden } from '../model/layer-state.ts';
import { clone } from '../model/types.ts';
import type { DesignDocument } from '../model/types.ts';
import type { EditorStore } from './store.ts';
export class TextEditSession {
  private before: DesignDocument | null = null;
  constructor(private readonly store: EditorStore) {}
  get id(): string | null {
    return this.store.editingTextId;
  }
  start(id: string): boolean {
    if (this.id === id) return true;
    if (this.id) this.commit();
    const n = this.store.doc.nodes.find((n) => n.id === id);
    if (!n || n.type !== 'text' || isLocked(this.store.doc, n) || isHidden(this.store.doc, n))
      return false;
    this.before = clone(this.store.doc);
    this.store.editingTextId = id;
    this.store.selected = new Set([id]);
    this.store.refresh();
    return true;
  }
  update(text: string): void {
    const n = this.store.doc.nodes.find((n) => n.id === this.id);
    if (!n || !this.before) return;
    n.text = text;
    this.store.refresh('scene');
  }
  commit(): void {
    const before = this.before;
    if (!before) return;
    this.before = null;
    this.store.editingTextId = null;
    try {
      this.store.commit(before);
    } catch (error) {
      this.store.doc = before;
      this.store.refresh();
      throw error;
    }
  }
  cancel(): void {
    if (!this.before) return;
    this.store.doc = this.before;
    this.before = null;
    this.store.editingTextId = null;
    this.store.refresh();
  }
}
