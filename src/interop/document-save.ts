import type { DesignDocument } from '../model/types.ts';
import type { EditorStore } from '../editor/store.ts';
import { documentNameFromFile, safeDocumentName } from './document-name.ts';
export interface WritableDocumentFile {
  write(data: string): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}
export interface DocumentFileHandle {
  readonly name: string;
  createWritable(): Promise<WritableDocumentFile>;
}
export interface SavePickerOptions {
  suggestedName: string;
  excludeAcceptAllOption: boolean;
  types: { description: string; accept: Record<string, string[]> }[];
}
export interface DocumentSaveEnvironment {
  pick?: (options: SavePickerOptions) => Promise<DocumentFileHandle>;
  requestName(current: string): string | null | Promise<string | null>;
  persist?(doc: DesignDocument): void;
  download(name: string, data: string, type: string, extension: string): void;
}
export interface SavedDocument {
  name: string;
  mode: 'file' | 'download' | 'browser';
}
/** File handles belong to one opened document/session and are not serialized. */
export class DocumentFileSaver {
  private handle: DocumentFileHandle | null = null;
  private generation = 0;
  private saving = false;
  constructor(
    private readonly store: EditorStore,
    private readonly environment: DocumentSaveEnvironment,
  ) {}
  get hasFile(): boolean {
    return this.handle !== null;
  }
  get currentHandle(): DocumentFileHandle | null {
    return this.handle;
  }
  reset(handle: DocumentFileHandle | null = null): void {
    this.handle = handle;
    this.generation++;
  }
  async save(asNew = false): Promise<SavedDocument | null> {
    if (this.saving) return null;
    this.saving = true;
    const generation = this.generation;
    try {
      const env = this.environment;
      let name: string, mode: SavedDocument['mode'];
      if (env.pick) {
        const suggested = safeDocumentName(this.store.doc.name);
        const handle =
          this.handle && !asNew
            ? this.handle
            : await env.pick({
                suggestedName: suggested + '.redesign',
                excludeAcceptAllOption: true,
                types: [
                  {
                    description: 'reDesign document',
                    accept: { 'application/json': ['.redesign'] },
                  },
                ],
              });
        if (generation !== this.generation) return null;
        this.handle = handle;
        name = documentNameFromFile(handle.name);
        const data = JSON.stringify({ ...this.store.doc, name }, null, 2);
        const writable = await handle.createWritable();
        try {
          await writable.write(data);
          await writable.close();
        } catch (error) {
          try {
            await writable.abort?.();
          } catch {
            /* Preserve the original write error. */
          }
          throw error;
        }
        if (generation !== this.generation) return null;
        this.handle = handle;
        mode = 'file';
      } else if (asNew) {
        const requested = await env.requestName(this.store.doc.name);
        if (generation !== this.generation) return null;
        if (requested === null) return null;
        name = safeDocumentName(requested);
        const data = JSON.stringify({ ...this.store.doc, name }, null, 2);
        env.download(name, data, 'application/json', '.redesign');
        mode = 'download';
      } else {
        if (!env.persist)
          throw new Error('Browser save unavailable. Download a copy to keep your work.');
        env.persist(this.store.doc);
        return { name: this.store.doc.name, mode: 'browser' };
      }
      if (this.store.doc.name !== name)
        this.store.change(() => {
          this.store.doc.name = name;
        });
      return { name, mode };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return null;
      throw error;
    } finally {
      this.saving = false;
    }
  }
}
