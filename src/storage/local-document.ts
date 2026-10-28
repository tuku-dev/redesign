import { validateDocument, createDocument } from '../model/document.ts';
import type { DesignDocument } from '../model/types.ts';
export interface DocumentStorage {
  load(): DesignDocument;
  save(doc: DesignDocument): void;
}
export function browserDocumentStorage(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): DocumentStorage {
  const key = 'redesign.document';
  return {
    load() {
      const saved = storage.getItem(key);
      return saved ? validateDocument(JSON.parse(saved)) : createDocument();
    },
    save(doc) {
      storage.setItem(key, JSON.stringify(doc));
    },
  };
}
