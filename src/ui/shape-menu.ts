import type { EditorStore } from '../editor/store.ts';
import { DRAW_SHAPES } from '../model/shapes.ts';
import type { DrawShape } from '../model/shapes.ts';
import type { EditorElements } from './elements.ts';
import { createIcon } from './icons.ts';

const LABELS: Record<DrawShape, string> = {
  rectangle: 'Rectangle',
  line: 'Line',
  star: 'Star',
};

function isDrawShape(value: string | undefined): value is DrawShape {
  return DRAW_SHAPES.some((shape) => shape === value);
}

/** Drop-up beside the rectangle tool that picks what the tool draws. */
export function bindShapeMenu(
  el: EditorElements,
  store: EditorStore,
  cancelGesture: () => void,
): void {
  const setOpen = (open: boolean) => {
    el.shapeMenu.hidden = !open;
    el.shapeMenuToggle.setAttribute('aria-expanded', String(open));
  };
  el.shapeMenuToggle.onclick = () => setOpen(el.shapeMenu.hidden !== false);
  el.shapeMenu.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach((item) => {
    item.onclick = () => {
      const shape = item.dataset.shape;
      if (!isDrawShape(shape)) return;
      cancelGesture();
      store.drawShape = shape;
      store.tool = 'rectangle';
      setOpen(false);
      store.refresh();
    };
  });
  document.addEventListener('pointerdown', (e) => {
    if (
      !el.shapeMenu.hidden &&
      e.target instanceof Node &&
      !el.shapeMenu.parentElement?.contains(e.target)
    )
      setOpen(false);
  });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || el.shapeMenu.hidden) return;
      e.stopImmediatePropagation();
      setOpen(false);
      el.shapeMenuToggle.focus();
    },
    true,
  );
}

export function renderShapeMenu(el: EditorElements, store: EditorStore): void {
  const button = el.toolButtons.find((b) => b.dataset.tool === 'rectangle');
  const label = LABELS[store.drawShape];
  if (button) {
    button.title = `${label} (R)`;
    button.setAttribute('aria-label', `${label} tool`);
    button.querySelector('[data-icon]')?.replaceChildren(createIcon(store.drawShape));
  }
  el.shapeMenu.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach((item) => {
    item.setAttribute('aria-checked', String(item.dataset.shape === store.drawShape));
  });
}
