import type { Tool } from '../model/types.ts';
import type { EditorStore } from '../editor/store.ts';
import type { GestureController } from '../editor/gestures.ts';
import type { ViewportController } from '../editor/viewport.ts';
import type { EditingCommands } from '../commands/editing.ts';
import type { EditorElements } from './elements.ts';
import type { Notify } from './notifications.ts';
export function isTool(value: string | undefined): value is Tool {
  return (
    value !== undefined &&
    ['select', 'hand', 'frame', 'rectangle', 'ellipse', 'text'].includes(value)
  );
}
export function bindToolbar(
  el: EditorElements,
  store: EditorStore,
  gestures: GestureController,
  viewport: ViewportController,
  commands: EditingCommands,
  notify: Notify,
): (selectionOnly: boolean) => void {
  el.snapGridEnabled.onclick = () => {
    store.gridSnappingEnabled = !store.gridSnappingEnabled;
    store.refresh('scene');
    renderToolbar(el, store);
  };
  el.pickColor.onclick = () => {
    store.canvasColorMode = store.canvasColorMode === 'sample' ? null : 'sample';
    store.refresh('all');
  };
  const center = () => ({ x: el.canvas.clientWidth / 2, y: el.canvas.clientHeight / 2 });
  el.zoomIn.onclick = () => viewport.setZoom(store.zoom * 1.2, center());
  el.zoomOut.onclick = () => viewport.setZoom(store.zoom / 1.2, center());
  el.zoomReset.onclick = () => viewport.setZoom(1, center());
  const fit = (selectionOnly: boolean) => {
    if (!viewport.fit(el.canvas.clientWidth, el.canvas.clientHeight, selectionOnly))
      notify(selectionOnly ? 'Select layers to fit.' : 'Add layers to fit.');
  };
  el.fitAll.onclick = () => fit(false);
  el.fitSelection.onclick = () => fit(true);
  el.toolButtons.forEach(
    (b) =>
      (b.onclick = () => {
        gestures.cancel();
        const tool = b.dataset.tool;
        if (isTool(tool)) {
          store.tool = tool;
          store.refresh();
        }
      }),
  );
  el.add.onclick = () => commands.addRectangle();
  el.undo.onclick = () => {
    gestures.cancel();
    store.undo();
  };
  el.redo.onclick = () => {
    gestures.cancel();
    store.redo();
  };
  el.documentName.onchange = () =>
    store.change(() => (store.doc.name = el.documentName.value.trim() || 'Untitled'));
  return fit;
}
export function renderToolbar(el: EditorElements, store: EditorStore): void {
  el.documentName.value = store.doc.name;
  document.title = store.doc.name + ' - reDesign';
  el.toolButtons.forEach((b) => {
    b.classList.toggle('active', b.dataset.tool === store.tool);
    b.setAttribute('aria-pressed', String(b.dataset.tool === store.tool));
  });
  el.snapGridEnabled.setAttribute('aria-pressed', String(store.gridSnappingEnabled));
  el.snapGridEnabled.classList.toggle('active', store.gridSnappingEnabled);
  el.pickColor.setAttribute('aria-pressed', String(store.canvasColorMode === 'sample'));
  el.pickColor.classList.toggle('active', store.canvasColorMode === 'sample');
  el.canvas.style.cursor = store.canvasColorMode
    ? 'crosshair'
    : store.tool === 'hand'
      ? 'grab'
      : store.tool === 'select'
        ? 'default'
        : 'crosshair';
  el.undo.disabled = !store.history.past.length;
  el.redo.disabled = !store.history.future.length;
}
