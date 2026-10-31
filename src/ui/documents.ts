import type { EditorStore } from '../editor/store.ts';
import { OPEN_DOCUMENTS_KEY, OpenDocuments, isPristine } from '../storage/open-documents.ts';
import type { ActivatedDocument } from '../storage/open-documents.ts';
import { createDocument } from '../model/document.ts';
import { clone } from '../model/types.ts';
import type { DesignDocument } from '../model/types.ts';
import type { DocumentFileHandle } from '../interop/document-save.ts';
import { errorMessage } from './elements.ts';
import type { Notify } from './notifications.ts';

export interface HandleHolder {
  readonly currentHandle: DocumentFileHandle | null;
  reset(handle?: DocumentFileHandle | null): void;
}
export interface DocumentSwitcher {
  open(doc: DesignDocument, handle?: DocumentFileHandle | null): void;
  newDocument(): void;
  duplicate(): void;
  close(id?: string): void;
  render(): void;
}

/** Coordinates the open-document registry with the editor store and file handle. */
export function bindDocuments(
  area: HTMLElement,
  store: EditorStore,
  saver: HandleHolder,
  notify: Notify,
  prepare: () => void,
): DocumentSwitcher {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(OPEN_DOCUMENTS_KEY);
  } catch {
    /* Storage can be unavailable; documents then live only in memory. */
  }
  const registry = OpenDocuments.restore(raw, store.doc);
  const live = () => ({ past: store.history.past, future: store.history.future });
  const apply = (next: ActivatedDocument) => {
    store.doc = next.doc;
    store.selected.clear();
    store.history.past.splice(0, store.history.past.length, ...next.history.past);
    store.history.future.splice(0, store.history.future.length, ...next.history.future);
    saver.reset((next.handle as DocumentFileHandle | null) ?? null);
    store.refresh('all', true);
  };
  const persist = () => {
    try {
      localStorage.setItem(OPEN_DOCUMENTS_KEY, registry.serialize(store.doc));
    } catch {
      /* Quota errors are reported by the main document autosave. */
    }
  };
  const guard = (action: () => void) => {
    try {
      prepare();
      action();
    } catch (error) {
      notify(errorMessage(error));
    }
  };
  const render = () => {
    area.replaceChildren();
    const tabs = document.createElement('ul');
    tabs.className = 'document-list';
    tabs.setAttribute('aria-label', 'Open documents');
    for (const item of registry.list(store.doc.name)) {
      const row = document.createElement('li');
      row.className = 'document-row' + (item.active ? ' active' : '');
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'document-select';
      select.textContent = item.name;
      select.title = item.name;
      select.setAttribute('aria-current', String(item.active));
      select.onclick = () =>
        guard(() => {
          const next = registry.switchTo(item.id, store.doc, live(), saver.currentHandle);
          if (next) apply(next);
        });
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'document-close';
      close.textContent = '×';
      close.setAttribute('aria-label', 'Close ' + item.name);
      close.onclick = () => guard(() => api.close(item.id));
      row.append(select, close);
      tabs.append(row);
    }
    const actions = document.createElement('div');
    actions.className = 'feature-actions';
    const duplicate = document.createElement('button');
    duplicate.type = 'button';
    duplicate.textContent = 'Duplicate document';
    duplicate.onclick = () => guard(() => api.duplicate());
    actions.append(duplicate);
    area.append(tabs, actions);
  };
  const api: DocumentSwitcher = {
    open(doc, handle = null) {
      // Opening into an untouched blank document replaces it instead of adding a tab.
      if (registry.count === 1 && isPristine(store.doc) && !store.history.past.length) {
        store.doc = doc;
        store.selected.clear();
        saver.reset(handle);
        store.refresh('all', true);
        return;
      }
      apply(registry.add(doc, store.doc, live(), saver.currentHandle, handle));
    },
    newDocument() {
      apply(registry.add(createDocument(), store.doc, live(), saver.currentHandle));
    },
    duplicate() {
      const copy = clone(store.doc);
      copy.name = store.doc.name + ' copy';
      apply(registry.add(copy, store.doc, live(), saver.currentHandle));
    },
    close(id = registry.active) {
      const target = registry.list(store.doc.name).find((d) => d.id === id);
      if (!target) return;
      const unsaved = id !== registry.active || !isPristine(store.doc);
      if (
        unsaved &&
        !window.confirm(
          `Close "${target.name}"? Unsaved changes are discarded. Save a copy first to keep it.`,
        )
      )
        return;
      const next = registry.close(id, store.doc, live(), saver.currentHandle);
      if (next) apply(next);
      else store.refresh('all', true);
    },
    render,
  };
  store.subscribe((update) => {
    if (update.persist) persist();
    if (update.view === 'all') render();
  });
  persist();
  render();
  return api;
}
