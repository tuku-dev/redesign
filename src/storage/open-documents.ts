import { createDocument, validateDocument } from '../model/document.ts';
import { clone } from '../model/types.ts';
import type { DesignDocument } from '../model/types.ts';

export interface HistorySnapshot {
  past: DesignDocument[];
  future: DesignDocument[];
}
export interface OpenDocumentSummary {
  id: string;
  name: string;
  active: boolean;
}
export interface ActivatedDocument {
  doc: DesignDocument;
  history: HistorySnapshot;
  handle: unknown;
}
interface Entry {
  id: string;
  doc: DesignDocument;
  history: HistorySnapshot;
  handle: unknown;
}
export const OPEN_DOCUMENTS_KEY = 'redesign.documents';
const MAX_OPEN = 12;

/** True when a document has no layers/pages content beyond the default empty state. */
export function isPristine(doc: DesignDocument): boolean {
  return (
    doc.name === 'Untitled' &&
    JSON.stringify({ ...doc, name: 'Untitled' }) === JSON.stringify(createDocument())
  );
}

/**
 * Tracks the documents open in this tab. The active document lives in the editor store;
 * this registry keeps inactive documents (with their own undo history and file handle).
 */
export class OpenDocuments {
  private entries: Entry[] = [];
  private activeId: string;

  constructor(active: DesignDocument = createDocument()) {
    this.activeId = crypto.randomUUID();
    this.entries.push(this.blank(this.activeId, active));
  }

  private blank(id: string, doc: DesignDocument): Entry {
    return { id, doc, history: { past: [], future: [] }, handle: null };
  }

  get count(): number {
    return this.entries.length;
  }
  get active(): string {
    return this.activeId;
  }
  get full(): boolean {
    return this.entries.length >= MAX_OPEN;
  }

  list(currentName: string): OpenDocumentSummary[] {
    return this.entries.map((e) => ({
      id: e.id,
      name: e.id === this.activeId ? currentName : e.doc.name,
      active: e.id === this.activeId,
    }));
  }

  /** Record the live state of the active document before leaving it or persisting. */
  snapshot(current: DesignDocument, history: HistorySnapshot, handle: unknown): void {
    const entry = this.entries.find((e) => e.id === this.activeId);
    if (!entry) return;
    entry.doc = clone(current);
    entry.history = { past: history.past.map(clone), future: history.future.map(clone) };
    entry.handle = handle;
  }

  /** Add a document after the active one and make it active. */
  add(
    doc: DesignDocument,
    current: DesignDocument,
    history: HistorySnapshot,
    handle: unknown,
    nextHandle: unknown = null,
  ): ActivatedDocument {
    if (this.full) throw new Error('Close a document before opening another (limit 12).');
    this.snapshot(current, history, handle);
    const entry = this.blank(crypto.randomUUID(), doc);
    entry.handle = nextHandle;
    const at = this.entries.findIndex((e) => e.id === this.activeId);
    this.entries.splice(at + 1, 0, entry);
    this.activeId = entry.id;
    return this.activated(entry);
  }

  switchTo(
    id: string,
    current: DesignDocument,
    history: HistorySnapshot,
    handle: unknown,
  ): ActivatedDocument | null {
    const target = this.entries.find((e) => e.id === id);
    if (!target || id === this.activeId) return null;
    this.snapshot(current, history, handle);
    this.activeId = id;
    return this.activated(target);
  }

  /** Remove a document. Closing the last one leaves a fresh empty document. */
  close(
    id: string,
    current: DesignDocument,
    history: HistorySnapshot,
    handle: unknown,
  ): ActivatedDocument | null {
    const at = this.entries.findIndex((e) => e.id === id);
    if (at < 0) return null;
    if (id !== this.activeId) {
      this.entries.splice(at, 1);
      return null;
    }
    this.snapshot(current, history, handle);
    this.entries.splice(at, 1);
    if (!this.entries.length) this.entries.push(this.blank(crypto.randomUUID(), createDocument()));
    const next = this.entries[Math.min(at, this.entries.length - 1)]!;
    this.activeId = next.id;
    return this.activated(next);
  }

  private activated(entry: Entry): ActivatedDocument {
    return {
      doc: clone(entry.doc),
      history: { past: entry.history.past.map(clone), future: entry.history.future.map(clone) },
      handle: entry.handle,
    };
  }

  serialize(current: DesignDocument): string {
    return JSON.stringify({
      activeId: this.activeId,
      documents: this.entries.map((e) => ({
        id: e.id,
        doc: e.id === this.activeId ? current : e.doc,
      })),
    });
  }

  /** Restore from storage. The active document is supplied separately by the caller. */
  static restore(raw: string | null, active: DesignDocument): OpenDocuments {
    const registry = new OpenDocuments(active);
    if (!raw) return registry;
    try {
      const data: unknown = JSON.parse(raw);
      if (typeof data !== 'object' || data === null) return registry;
      const { activeId, documents } = data as { activeId?: unknown; documents?: unknown };
      if (typeof activeId !== 'string' || !Array.isArray(documents)) return registry;
      const entries: Entry[] = [];
      for (const item of documents.slice(0, MAX_OPEN)) {
        const { id, doc } = item as { id?: unknown; doc?: unknown };
        if (typeof id !== 'string' || !id || entries.some((e) => e.id === id)) continue;
        entries.push(registry.blank(id, id === activeId ? active : validateDocument(doc)));
      }
      if (!entries.some((e) => e.id === activeId)) return registry;
      registry.entries = entries;
      registry.activeId = activeId;
    } catch {
      return new OpenDocuments(active);
    }
    return registry;
  }
}
