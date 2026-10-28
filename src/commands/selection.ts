import { withinClips } from '../model/clipping.ts';
import { pointInNode } from '../model/rotation.ts';
import type { EditorStore } from '../editor/store.ts';
import { hierarchyRows, descendants } from '../model/hierarchy.ts';
import { isHidden, isLocked, groupedTarget } from '../model/layer-state.ts';
import type { Point } from '../model/types.ts';
export class SelectionCommands {
  constructor(private readonly store: EditorStore) {}
  context(id: string | null, fromLayers = false, deep = false): void {
    const s = this.store;
    if (!id) {
      this.none();
      return;
    }
    if (s.selected.has(id)) return;
    if (!fromLayers && descendants(s.doc, s.selected).some((n) => n.id === id)) return;
    this.select(fromLayers ? id : groupedTarget(s.doc, id, deep));
  }
  all(): void {
    const s = this.store;
    s.selected = new Set(
      s.doc.nodes.filter((n) => !isHidden(s.doc, n) && !isLocked(s.doc, n)).map((n) => n.id),
    );
    s.refresh();
  }
  none(): void {
    this.store.selected.clear();
    this.store.refresh();
  }
  parent(): void {
    const s = this.store;
    s.selected = new Set(
      s
        .chosen()
        .map((n) => n.parentId)
        .filter((id): id is string => id !== null),
    );
    s.refresh();
  }
  children(): void {
    const s = this.store;
    s.selected = new Set(
      s.doc.nodes
        .filter(
          (n) =>
            n.parentId && s.selected.has(n.parentId) && !isHidden(s.doc, n) && !isLocked(s.doc, n),
        )
        .map((n) => n.id),
    );
    s.refresh();
  }
  at(point: Point): string[] {
    const s = this.store;
    return hierarchyRows(s.doc)
      .map((row) => row.node)
      .reverse()
      .filter((n) => !isHidden(s.doc, n) && pointInNode(point, n) && withinClips(s.doc, n, point))
      .map((n) => n.id);
  }
  select(id: string): void {
    this.store.selected = new Set([id]);
    this.store.refresh();
  }
}
