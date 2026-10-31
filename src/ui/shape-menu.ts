import type { EditorStore } from '../editor/store.ts';
import { DRAW_SHAPES } from '../model/shapes.ts';
import type { DrawShape } from '../model/shapes.ts';
import type { EditorElements } from './elements.ts';
import { createIcon } from './icons.ts';

const LABELS: Record<DrawShape, string> = {
  rectangle: 'Rectangle',
  line: 'Line',
  arrow: 'Arrow',
  polygon: 'Polygon',
  star: 'Star',
};
const SHORTCUTS: Partial<Record<DrawShape, string>> = {
  rectangle: ' (R)',
  line: ' (L)',
  arrow: ' (Shift+L)',
};
/** Opens the image picker; the workspace panel owns the file input. */
export const INSERT_IMAGE_EVENT = 'redesign:insert-image';

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
      cancelGesture();
      if (shape === 'ellipse') store.tool = 'ellipse';
      else if (isDrawShape(shape)) {
        store.drawShape = shape;
        store.tool = 'rectangle';
      } else return;
      setOpen(false);
      store.refresh();
    };
  });
  el.shapeMenu.querySelector<HTMLButtonElement>('[data-action=image]')!.onclick = () => {
    cancelGesture();
    setOpen(false);
    document.dispatchEvent(new Event(INSERT_IMAGE_EVENT));
  };
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
    button.title = `${label}${SHORTCUTS[store.drawShape] ?? ''}`;
    button.setAttribute('aria-label', `${label} tool`);
    button.querySelector('[data-icon]')?.replaceChildren(createIcon(store.drawShape));
  }
  el.shapeMenu.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach((item) => {
    const checked =
      item.dataset.shape === 'ellipse'
        ? store.tool === 'ellipse'
        : store.tool !== 'ellipse' && item.dataset.shape === store.drawShape;
    item.setAttribute('aria-checked', String(checked));
  });
}
