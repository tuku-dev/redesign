import type { GestureController } from '../editor/gestures.ts';
import type { MenuServices } from './context-menu-actions.ts';
import { descendants, detachedCopy } from '../model/hierarchy.ts';
import { exportSvg } from '../interop/svg-export.ts';
import { downloadFile } from '../interop/download.ts';
import type { EditorElements } from './elements.ts';
import type { EditorStore } from '../editor/store.ts';
import type { Notify } from './notifications.ts';
export function renameSelection(elements: EditorElements): void {
  const input = elements.properties.querySelector<HTMLInputElement>('input[aria-label="Name"]');
  input?.focus();
  input?.select();
}
export function exportSelection(store: EditorStore, notify: Notify): void {
  const nodes = detachedCopy(descendants(store.doc, store.selected)),
    data = exportSvg({ ...store.doc, nodes });
  if (!data) return notify('Select visible layers to export.');
  downloadFile(
    store.chosen().length === 1 ? store.chosen()[0].name : store.doc.name + ' selection',
    data,
    'image/svg+xml',
    '.svg',
  );
}
export function bindActionShortcuts(s: MenuServices, gestures: GestureController): void {
  document.addEventListener('keydown', (e) => {
    if (
      gestures.active ||
      e.defaultPrevented ||
      (e.target instanceof Element &&
        e.target.closest('input,textarea,select,dialog,[contenteditable]'))
    )
      return;
    const mod = e.ctrlKey || e.metaKey,
      key = e.key.toLowerCase();
    let run: (() => void) | undefined;
    if (mod && key === 'g')
      run = e.altKey
        ? () => s.structure.wrap('frame')
        : e.shiftKey
          ? () => s.structure.unwrap()
          : () => s.structure.wrap('group');
    if (mod && e.shiftKey && key === 'l') run = () => s.states.toggle('locked');
    if (mod && e.shiftKey && key === 'h') run = () => s.states.toggle('hidden');
    if (mod && (e.code === 'BracketLeft' || e.code === 'BracketRight'))
      run = () =>
        s.order.order(
          e.code === 'BracketRight'
            ? e.shiftKey
              ? 'front'
              : 'forward'
            : e.shiftKey
              ? 'back'
              : 'backward',
        );
    if (e.key === 'F2') run = s.rename;
    if (e.key === 'Enter' && !mod)
      run = e.shiftKey ? () => s.selection.parent() : () => s.selection.children();
    if (run) {
      e.preventDefault();
      run();
    }
  });
}
