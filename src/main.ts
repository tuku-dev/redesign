import { TextEditSession } from './editor/text-edit.ts';
import { bindInlineText } from './ui/inline-text.ts';
import { StructureCommands } from './commands/structure.ts';
import { LayerStateCommands } from './commands/layer-state.ts';
import { LayerOrderCommands } from './commands/layer-order.ts';
import { SelectionCommands } from './commands/selection.ts';
import { bindContextMenu } from './ui/context-menu.ts';
import { bindActionShortcuts, renameSelection, exportSelection } from './ui/editor-actions.ts';
import type { MenuServices } from './ui/context-menu-actions.ts';
import './editor/style.css';
import { EditorStore } from './editor/store.ts';
import { GestureController } from './editor/gestures.ts';
import { ViewportController } from './editor/viewport.ts';
import { bindPointer } from './editor/pointer.ts';
import { bindKeyboard } from './editor/keyboard.ts';
import { EditingCommands } from './commands/editing.ts';
import { ClipboardController } from './interop/clipboard-controller.ts';
import { bindFileActions } from './interop/file-actions.ts';
import { getElements } from './ui/elements.ts';
import { createNotifications } from './ui/notifications.ts';
import { mountIcons } from './ui/icons.ts';
import { bindToolbar, renderToolbar } from './ui/toolbar.ts';
import { renderLayers } from './ui/layers.ts';
import { renderProperties } from './ui/properties.ts';
import { renderScene } from './render/scene.ts';
import { browserDocumentStorage } from './storage/local-document.ts';

const elements = getElements();
const notify = createNotifications(elements.toast);
const store = new EditorStore();
let storage: ReturnType<typeof browserDocumentStorage> | undefined;
try {
  storage = browserDocumentStorage(localStorage);
  store.doc = storage.load();
} catch {
  notify('Could not restore local document. Open a saved file to recover.');
}
const gestures = new GestureController(store);
const viewport = new ViewportController(store);
const commands = new EditingCommands(store);
const clipboard = new ClipboardController(store, notify);
const textSession = new TextEditSession(store);
const inlineText = bindInlineText(elements, store, textSession, notify);
store.subscribe((update) => {
  if (update.persist) {
    try {
      if (!storage) throw new Error('Storage unavailable');
      storage.save(store.doc);
      elements.saveStatus.textContent = 'Saved in this browser';
    } catch {
      elements.saveStatus.textContent = 'Local save unavailable - use Save file';
    }
  }
  renderScene(elements, store, gestures);
  inlineText.sync();
  if (update.view === 'all') {
    renderToolbar(elements, store);
    renderLayers(elements.layers, store);
    renderProperties(elements.properties, store, commands, clipboard, notify);
  }
});
const fit = bindToolbar(elements, store, gestures, viewport, commands, notify);
bindFileActions(elements, store, notify);
bindPointer(elements, store, gestures, viewport, notify, inlineText.begin);
bindKeyboard(store, gestures, commands, clipboard, () => elements.save.click(), fit);
clipboard.bind(document, gestures, commands);
const services: MenuServices = {
  store,
  commands,
  clipboard,
  structure: new StructureCommands(store),
  states: new LayerStateCommands(store),
  order: new LayerOrderCommands(store),
  selection: new SelectionCommands(store),
  fit,
  rename: () => renameSelection(elements),
  exportSelection: () => exportSelection(store, notify),
};
bindContextMenu(elements, services, gestures, viewport, notify);
bindActionShortcuts(services, gestures);
mountIcons();
store.refresh();
