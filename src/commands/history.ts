import { clone } from '../model/types.ts';
import type { DesignDocument } from '../model/types.ts';
export class History {
  readonly past: DesignDocument[] = [];
  readonly future: DesignDocument[] = [];
  push(doc: DesignDocument): void {
    this.past.push(clone(doc));
    if (this.past.length > 100) this.past.shift();
    this.future.length = 0;
  }
  undo(doc: DesignDocument): DesignDocument {
    const previous = this.past.pop();
    if (!previous) return doc;
    this.future.push(clone(doc));
    return previous;
  }
  redo(doc: DesignDocument): DesignDocument {
    const next = this.future.pop();
    if (!next) return doc;
    this.past.push(clone(doc));
    return next;
  }
}
