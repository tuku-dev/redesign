import type { EditorElements } from './elements.ts';
import { createIcon } from './icons.ts';

type PenMode = 'pen' | 'pencil';
const LABELS: Record<PenMode, string> = { pen: 'Pen (P)', pencil: 'Pencil (Shift+P)' };

function isPenMode(value: string | undefined): value is PenMode {
  return value === 'pen' || value === 'pencil';
}

/** Drop-up beside the pen tool: pen, pencil and the color picker. */
export function bindPenMenu(
  el: EditorElements,
  vector: { start: () => void; startPencil: () => void },
): { select: (mode: PenMode) => void } {
  let mode: PenMode = 'pen';
  const setOpen = (open: boolean) => {
    el.penMenu.hidden = !open;
    el.penMenuToggle.setAttribute('aria-expanded', String(open));
  };
  const render = () => {
    el.penButton.title = LABELS[mode];
    el.penButton.setAttribute('aria-label', `${mode === 'pen' ? 'Pen' : 'Pencil'} tool`);
    el.penButton.querySelector('[data-icon]')?.replaceChildren(createIcon(mode));
    el.penMenu.querySelectorAll<HTMLButtonElement>('[data-pen]').forEach((item) => {
      item.setAttribute('aria-checked', String(item.dataset.pen === mode));
    });
  };
  const select = (next: PenMode) => {
    mode = next;
    render();
    if (next === 'pencil') vector.startPencil();
    else vector.start();
  };
  el.penButton.onclick = () => select(mode);
  el.penMenuToggle.onclick = () => setOpen(el.penMenu.hidden !== false);
  el.penMenu.querySelectorAll<HTMLButtonElement>('[data-pen]').forEach((item) => {
    item.onclick = () => {
      const next = item.dataset.pen;
      if (!isPenMode(next)) return;
      setOpen(false);
      select(next);
    };
  });
  el.pickColor.addEventListener('click', () => setOpen(false));
  document.addEventListener('pointerdown', (e) => {
    if (
      !el.penMenu.hidden &&
      e.target instanceof Node &&
      !el.penMenu.parentElement?.contains(e.target)
    )
      setOpen(false);
  });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || el.penMenu.hidden) return;
      e.stopImmediatePropagation();
      setOpen(false);
      el.penMenuToggle.focus();
    },
    true,
  );
  render();
  return { select };
}
