import type { EditorStore } from '../editor/store.ts';
import type { EditorElements } from './elements.ts';
import type { Notify } from './notifications.ts';
import { createIcon } from './icons.ts';

type TextMode = EditorStore['textMode'];
const TITLES: Record<TextMode, string> = { text: 'Text (T)', path: 'Text on path' };
const NAMES: Record<TextMode, string> = { text: 'Text', path: 'Text on path' };

/** Drop-up beside the text tool that picks plain text or text on a path. */
export function bindTextMenu(
  el: EditorElements,
  store: EditorStore,
  cancelGesture: () => void,
  notify: Notify,
): void {
  const setOpen = (open: boolean) => {
    el.textMenu.hidden = !open;
    el.textMenuToggle.setAttribute('aria-expanded', String(open));
  };
  el.textMenuToggle.onclick = () => setOpen(el.textMenu.hidden !== false);
  el.textMenu.querySelectorAll<HTMLButtonElement>('[data-text]').forEach((item) => {
    item.onclick = () => {
      const mode = item.dataset.text;
      if (mode !== 'text' && mode !== 'path') return;
      cancelGesture();
      store.textMode = mode;
      store.tool = 'text';
      setOpen(false);
      store.refresh();
      if (mode === 'path') notify('Click a path, line or shape to place text on it.');
    };
  });
  document.addEventListener('pointerdown', (e) => {
    if (
      !el.textMenu.hidden &&
      e.target instanceof Node &&
      !el.textMenu.parentElement?.contains(e.target)
    )
      setOpen(false);
  });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || el.textMenu.hidden) return;
      e.stopImmediatePropagation();
      setOpen(false);
      el.textMenuToggle.focus();
    },
    true,
  );
}

export function renderTextMenu(el: EditorElements, store: EditorStore): void {
  const button = el.toolButtons.find((b) => b.dataset.tool === 'text');
  if (button) {
    button.title = TITLES[store.textMode];
    button.setAttribute('aria-label', `${NAMES[store.textMode]} tool`);
    button
      .querySelector('[data-icon]')
      ?.replaceChildren(createIcon(store.textMode === 'path' ? 'textPath' : 'text'));
  }
  el.textMenu.querySelectorAll<HTMLButtonElement>('[data-text]').forEach((item) => {
    item.setAttribute('aria-checked', String(item.dataset.text === store.textMode));
  });
}
