import type { EditorStore } from '../editor/store.ts';
import type { GestureController } from '../editor/gestures.ts';
import type { EditorElements } from '../ui/elements.ts';
import { renderDocument } from './document.ts';
import { renderSelection } from './selection-overlay.ts';
export function renderScene(
  elements: EditorElements,
  store: EditorStore,
  gestures: GestureController,
): void {
  const { pan, zoom } = store;
  elements.viewport.setAttribute('transform', `translate(${pan.x} ${pan.y}) scale(${zoom})`);
  elements.scene.replaceChildren(
    ...renderDocument(store.doc, { interactive: true, editingTextId: store.editingTextId }),
  );
  renderSelection(elements.selection, store, gestures);
  elements.zoomReset.textContent = Math.round(zoom * 100) + '%';
}
