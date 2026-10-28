import { updateGroupBounds } from '../model/groups.ts';
import { createDocument, validateDocument } from '../model/document.ts';
import { selectedNodes } from '../model/selection.ts';
import { clone } from '../model/types.ts';
import type { DesignDocument, DesignNode, Point, Tool } from '../model/types.ts';
import { History } from '../commands/history.ts';
export interface EditorUpdate {
  view: 'scene' | 'all';
  persist: boolean;
}
export class EditorStore {
  doc: DesignDocument;
  selected = new Set<string>();
  tool: Tool = 'select';
  zoom = 1;
  pan: Point = { x: 80, y: 80 };
  space = false;
  snappingEnabled = true;
  editingTextId: string | null = null;
  readonly history = new History();
  private readonly listeners = new Set<(update: EditorUpdate) => void>();
  constructor(doc: DesignDocument = createDocument()) {
    this.doc = validateDocument(doc);
  }
  chosen(): DesignNode[] {
    return selectedNodes(this.doc, this.selected);
  }
  current(): DesignNode | undefined {
    return this.chosen()[0];
  }
  subscribe(listener: (update: EditorUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  refresh(view: EditorUpdate['view'] = 'all', persist = false): void {
    updateGroupBounds(this.doc);
    this.selected = new Set(this.chosen().map((n) => n.id));
    this.listeners.forEach((listener) => listener({ view, persist }));
  }
  commit(before: DesignDocument): void {
    updateGroupBounds(this.doc);
    if (JSON.stringify(before) !== JSON.stringify(this.doc)) {
      this.doc = validateDocument(this.doc);
      this.history.push(before);
      this.refresh('all', true);
    } else this.refresh();
  }
  change(action: () => void): void {
    const before = clone(this.doc),
      selection = new Set(this.selected);
    try {
      action();
      this.commit(before);
    } catch (error) {
      this.doc = before;
      this.selected = selection;
      this.refresh();
      throw error;
    }
  }
  undo(): void {
    this.doc = this.history.undo(this.doc);
    this.selected.clear();
    this.refresh('all', true);
  }
  redo(): void {
    this.doc = this.history.redo(this.doc);
    this.selected.clear();
    this.refresh('all', true);
  }
}
