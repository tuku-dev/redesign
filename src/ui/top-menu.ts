import type { GestureController } from '../editor/gestures.ts';
import type { EditorElements } from './elements.ts';
import { errorMessage } from './elements.ts';
import type { MenuServices } from './context-menu-actions.ts';
import { isLocked } from '../model/layer-state.ts';
import { selectionRoots } from '../model/hierarchy.ts';
import type { Notify } from './notifications.ts';

type MenuAction = () => void | Promise<void>;

export function bindTopMenu(
  elements: EditorElements,
  services: MenuServices,
  gestures: GestureController,
  notify: Notify,
): void {
  const menu = elements.mainMenu;
  const close = () => {
    for (const button of menu.querySelectorAll<HTMLButtonElement>('[data-main-menu]')) {
      button.setAttribute('aria-expanded', 'false');
      menu
        .querySelector<HTMLElement>(`#${button.getAttribute('aria-controls')}`)
        ?.setAttribute('hidden', '');
    }
  };
  const actions: Record<string, MenuAction> = {
    new: () => elements.newDocument.click(),
    open: () => elements.open.click(),
    save: () => elements.save.click(),
    'save-as': () => elements.saveAs.click(),
    export: () => elements.exportSvg.click(),
    undo: () => services.store.undo(),
    redo: () => services.store.redo(),
    cut: () => {
      services.clipboard.copy();
      services.commands.remove();
    },
    copy: () => services.clipboard.copy(),
    paste: () => services.clipboard.readAndPaste(),
    duplicate: () => services.commands.duplicate(),
    delete: () => services.commands.remove(),
    rename: services.rename,
    'select-all': () => services.selection.all(),
    'deselect-all': () => services.selection.none(),
    'zoom-in': () => elements.zoomIn.click(),
    'zoom-out': () => elements.zoomOut.click(),
    'zoom-reset': () => elements.zoomReset.click(),
    'fit-all': () => services.fit(false),
    'fit-selection': () => services.fit(true),
    'snap-grid': () => elements.snapGridEnabled.click(),
    group: () => services.structure.wrap('group'),
    frame: () => services.structure.wrap('frame'),
    ungroup: () => services.structure.unwrap(),
    'bring-front': () => services.order.order('front'),
    'bring-forward': () => services.order.order('forward'),
    'send-backward': () => services.order.order('backward'),
    'send-back': () => services.order.order('back'),
    'align-left': () => services.commands.align('left'),
    'align-center': () => services.commands.align('center'),
    'align-right': () => services.commands.align('right'),
    'align-top': () => services.commands.align('top'),
    'align-middle': () => services.commands.align('middle'),
    'align-bottom': () => services.commands.align('bottom'),
  };
  for (const button of menu.querySelectorAll<HTMLButtonElement>('[data-main-menu]')) {
    button.onclick = () => {
      const panel = menu.querySelector<HTMLElement>(`#${button.getAttribute('aria-controls')}`);
      if (!panel) return;
      const open = button.getAttribute('aria-expanded') !== 'true';
      close();
      button.setAttribute('aria-expanded', String(open));
      panel.toggleAttribute('hidden', !open);
    };
    button.onkeydown = (event) => {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      button.click();
      menu
        .querySelector<HTMLElement>(`#${button.getAttribute('aria-controls')}`)
        ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
        ?.focus();
    };
  }
  for (const button of menu.querySelectorAll<HTMLButtonElement>('[data-main-menu-action]')) {
    button.onclick = () => {
      const action = actions[button.dataset.mainMenuAction ?? ''];
      if (!action || button.disabled) return;
      close();
      gestures.cancel();
      try {
        const result = action();
        if (result instanceof Promise) void result.catch((error) => notify(errorMessage(error)));
      } catch (error) {
        notify(errorMessage(error));
      }
    };
  }
  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Node && !menu.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}

export function renderTopMenu(elements: EditorElements, services: MenuServices): void {
  const nodes = services.store.chosen();
  const roots = selectionRoots(services.store.doc, services.store.selected);
  const hasSelection = nodes.length > 0;
  const editable = hasSelection && !nodes.some((node) => isLocked(services.store.doc, node));
  const canUngroup =
    editable && roots.some((node) => node.type === 'group' || node.type === 'frame');
  const canAlign = editable && roots.length > 1;
  const disabled: Record<string, boolean> = {
    undo: !services.store.history.past.length,
    redo: !services.store.history.future.length,
    cut: !editable,
    copy: !hasSelection,
    duplicate: !editable,
    delete: !editable,
    rename: !editable || nodes.length !== 1,
    'fit-selection': !hasSelection,
    group: !editable,
    frame: !editable,
    ungroup: !canUngroup,
    'bring-front': !editable,
    'bring-forward': !editable,
    'send-backward': !editable,
    'send-back': !editable,
    'align-left': !canAlign,
    'align-center': !canAlign,
    'align-right': !canAlign,
    'align-top': !canAlign,
    'align-middle': !canAlign,
    'align-bottom': !canAlign,
  };
  for (const button of elements.mainMenu.querySelectorAll<HTMLButtonElement>(
    '[data-main-menu-action]',
  ))
    button.disabled = disabled[button.dataset.mainMenuAction ?? ''] ?? false;
}
