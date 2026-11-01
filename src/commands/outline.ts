import { strokeOutline } from '../model/stroke-outline.ts';
import { createNode } from '../model/document.ts';
import { vectorFromPoints } from '../model/vector.ts';
import { defaultAppearance } from '../model/features.ts';
import { isLocked } from '../model/layer-state.ts';
import type { EditorStore } from '../editor/store.ts';
export class OutlineCommands {
  constructor(private readonly store: EditorStore) {}
  outline(): void {
    const s = this.store,
      n = s.current();
    if (s.chosen().length !== 1 || !n || isLocked(s.doc, n)) return;
    const appearance = n.appearance;
    if (!appearance) throw Error('Choose a shape with a stroke.');
    if (appearance.shadow.enabled || appearance.blur)
      throw Error('Remove effects before outlining the stroke.');
    const geometry = vectorFromPoints(strokeOutline(n));
    s.change(() => {
      const group = createNode('group', {
        ...geometry,
        type: 'group',
        name: n.name + ' outlined',
        parentId: n.parentId,
        opacity: n.opacity,
        ...(n.prototype ? { prototype: n.prototype } : {}),
      });
      delete group.vector;
      const outline = createNode('path', {
        ...geometry,
        name: 'Outlined stroke',
        parentId: group.id,
        fill: appearance.stroke,
        appearance: { ...defaultAppearance(), fillOpacity: appearance.strokeOpacity ?? 1 },
      });
      const index = s.doc.nodes.indexOf(n);
      n.parentId = group.id;
      n.opacity = 1;
      delete n.prototype;
      n.appearance = { ...appearance, strokeWidth: 0 };
      s.doc.nodes.splice(index, 0, group);
      s.doc.nodes.splice(index + 2, 0, outline);
      s.selected = new Set([group.id]);
    });
  }
}
