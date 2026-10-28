import { visualBox } from '../model/rotation.ts';
import { bounds, fitView } from '../model/geometry.ts';
import type { Point } from '../model/types.ts';
import type { EditorStore } from './store.ts';
export class ViewportController {
  constructor(private readonly store: EditorStore) {}
  point(client: Point, origin: Point): Point {
    const s = this.store;
    return {
      x: (client.x - origin.x - s.pan.x) / s.zoom,
      y: (client.y - origin.y - s.pan.y) / s.zoom,
    };
  }
  setZoom(value: number, anchor: Point): void {
    const s = this.store,
      next = Math.max(0.1, Math.min(8, value));
    s.pan = {
      x: anchor.x - ((anchor.x - s.pan.x) * next) / s.zoom,
      y: anchor.y - ((anchor.y - s.pan.y) * next) / s.zoom,
    };
    s.zoom = next;
    s.refresh('scene');
  }
  fit(width: number, height: number, selectionOnly = false): boolean {
    const s = this.store,
      view = fitView(
        bounds((selectionOnly ? s.chosen() : s.doc.nodes).map(visualBox)),
        width,
        height,
      );
    if (!view) return false;
    s.zoom = view.zoom;
    s.pan = view.pan;
    s.refresh('scene');
    return true;
  }
}
