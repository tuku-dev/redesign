import { SelectionCommands } from '../commands/selection.ts';
import { INSERT_IMAGE_EVENT } from '../ui/shape-menu.ts';
import type { Tool } from '../model/types.ts';
import type { EditorStore } from './store.ts';
import type { GestureController } from './gestures.ts';
import type { EditingCommands } from '../commands/editing.ts';
import type { ClipboardController } from '../interop/clipboard-controller.ts';
import { editableTarget } from '../ui/elements.ts';
export function bindKeyboard(
  store: EditorStore,
  gestures: GestureController,
  commands: EditingCommands,
  clipboard: ClipboardController,
  fit: (selectionOnly: boolean) => void,
): void {
  document.addEventListener('keydown', (e) => {
    if (editableTarget(e.target)) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!gestures.cancel()) {
        store.selected.clear();
        store.tool = 'select';
        store.refresh();
      }
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!store.space) {
        store.space = true;
        store.refresh();
      }
      return;
    }
    if (gestures.active) {
      if (
        (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
        gestures.adjustSides(e.key === 'ArrowUp' ? 1 : -1)
      ) {
        e.preventDefault();
        return;
      }
      if (e.ctrlKey || e.metaKey || ['Delete', 'Backspace'].includes(e.key)) e.preventDefault();
      return;
    }
    const mod = e.ctrlKey || e.metaKey,
      key = e.key.toLowerCase();
    if (mod && key === 'a') {
      e.preventDefault();
      new SelectionCommands(store).all();
      return;
    }
    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
      return;
    }
    if (mod && key === 'd') {
      e.preventDefault();
      commands.duplicate();
      return;
    }
    if (mod && key === 'v') clipboard.pasteInPlace = e.shiftKey;
    if (e.shiftKey && (e.code === 'Digit1' || e.code === 'Digit2')) {
      e.preventDefault();
      fit(e.code === 'Digit2');
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      commands.remove();
      return;
    }
    const arrows: Record<string, readonly [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const arrow = arrows[e.key];
    if (store.selected.size && arrow) {
      e.preventDefault();
      const [x, y] = arrow,
        step = e.shiftKey ? 10 : 1;
      commands.nudge(x * step, y * step);
      return;
    }
    if (mod && e.shiftKey && key === 'k') {
      e.preventDefault();
      document.dispatchEvent(new Event(INSERT_IMAGE_EVENT));
      return;
    }
    if (!mod && (key === 'l' || key === 'r')) {
      store.drawShape = key === 'r' ? 'rectangle' : e.shiftKey ? 'arrow' : 'line';
      store.tool = 'rectangle';
      store.refresh();
      return;
    }
    const tools: Record<string, Tool> = {
      v: 'select',
      h: 'hand',
      f: 'frame',
      o: 'ellipse',
      t: 'text',
    };
    const tool = tools[key];
    if (!mod && tool) {
      store.tool = tool;
      store.refresh();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      store.space = false;
      store.refresh();
    }
  });
  window.addEventListener('blur', () => {
    store.space = false;
    store.refresh();
    gestures.cancel();
  });
}
