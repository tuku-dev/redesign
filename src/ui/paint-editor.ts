import type { Appearance, Paint, StrokePaint } from '../model/features.ts';
import type { Notify } from './notifications.ts';
import { button, inputField } from './feature-controls.ts';
import { renderGradientEditor } from './gradient-editor.ts';
import { createIcon } from './icons.ts';

interface PaintEditorOptions {
  fill: string;
  getAppearance: () => Appearance;
  update: (action: (value: Appearance) => void) => void;
  notify: Notify;
}

const fills = (appearance: Appearance, fill: string): Paint[] =>
  appearance.fills ?? [{ type: 'solid', color: fill, opacity: appearance.fillOpacity ?? 1 }];
const strokes = (appearance: Appearance): StrokePaint[] =>
  appearance.strokes ??
  (appearance.strokeWidth
    ? [
        {
          type: 'solid',
          color: appearance.stroke,
          opacity: appearance.strokeOpacity ?? 1,
          width: appearance.strokeWidth,
        },
      ]
    : []);

export function openPaintEditor(options: PaintEditorOptions): void {
  const { fill, getAppearance, update, notify } = options;
  const dialog = document.createElement('dialog');
  dialog.className = 'gradient-editor paint-editor';
  dialog.setAttribute('aria-label', 'Edit paints');
  const previous = document.activeElement as HTMLElement | null;
  const close = () => {
    dialog.close();
    dialog.remove();
    previous?.focus();
  };
  const render = () => {
    const appearance = getAppearance();
    const title = document.createElement('h2');
    title.textContent = 'Edit paints';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'gradient-editor-close';
    closeButton.setAttribute('aria-label', 'Close paint editor');
    closeButton.title = 'Close paint editor';
    closeButton.append(createIcon('close'));
    closeButton.onclick = close;
    const heading = document.createElement('div');
    heading.className = 'gradient-editor-header';
    heading.append(title, closeButton);
    const content = document.createElement('div');
    content.className = 'paint-editor-content';
    const updateAndRender = (action: (value: Appearance) => void) => {
      update(action);
      render();
    };
    const fillHeading = document.createElement('h3');
    fillHeading.textContent = 'Fills';
    content.append(fillHeading);
    const editableGradient = fills(appearance, fill).findIndex((paint) => paint.type !== 'solid');
    fills(appearance, fill).forEach((paint, index) => {
      if (paint.type !== 'solid' && index !== editableGradient) return;
      const section = document.createElement('div');
      section.className = 'paint-editor-row';
      if (paint.type === 'solid') {
        inputField(
          section,
          `Fill ${index + 1} color`,
          paint.color,
          'color',
          (color) =>
            updateAndRender((value) => {
              value.fills = fills(value, fill);
              const target = value.fills[index];
              if (target?.type === 'solid') target.color = color;
            }),
          notify,
        );
        section.append(
          button(
            `Convert fill ${index + 1} to gradient`,
            () =>
              updateAndRender((value) => {
                value.fills = fills(value, fill);
                const target = value.fills[index];
                if (!target || target.type !== 'solid') return;
                value.fills[index] = {
                  type: 'linear',
                  opacity: target.opacity,
                  stops: [
                    { color: target.color || '#000000', opacity: 1, position: 0 },
                    { color: '#ffffff', opacity: 1, position: 1 },
                  ],
                  start: { x: 0, y: 0.5 },
                  end: { x: 1, y: 0.5 },
                };
              }),
            notify,
          ),
        );
        inputField(
          section,
          `Fill ${index + 1} opacity`,
          paint.opacity,
          'number',
          (opacity) =>
            updateAndRender((value) => {
              value.fills = fills(value, fill);
              value.fills[index]!.opacity = Number(opacity);
            }),
          notify,
        );
      } else {
        section.classList.add('paint-editor-gradient-row');
        renderGradientEditor({
          fillIndex: index,
          getAppearance,
          update,
          remove: () =>
            update((value) => {
              value.fills = fills(value, fill);
              value.fills.splice(index, 1);
            }),
          notify,
          host: section,
          onClose: render,
        });
      }
      if (paint.type === 'solid')
        section.append(
          button(
            `Remove fill ${index + 1}`,
            () =>
              updateAndRender((value) => {
                value.fills = fills(value, fill);
                value.fills.splice(index, 1);
              }),
            notify,
          ),
        );
      content.append(section);
    });
    const fillActions = document.createElement('div');
    fillActions.className = 'gradient-editor-actions';
    fillActions.append(
      button(
        'Add fill',
        () =>
          updateAndRender((value) => {
            value.fills = [...fills(value, fill), { type: 'solid', color: '#000000', opacity: 1 }];
          }),
        notify,
      ),
    );
    content.append(fillActions);
    const strokeHeading = document.createElement('h3');
    strokeHeading.textContent = 'Strokes';
    content.append(strokeHeading);
    strokes(appearance).forEach((stroke, index) => {
      if (stroke.type !== 'solid') return;
      const section = document.createElement('div');
      section.className = 'paint-editor-row';
      inputField(
        section,
        `Stroke ${index + 1} color`,
        stroke.color,
        'color',
        (color) =>
          updateAndRender((value) => {
            value.strokes = strokes(value);
            const target = value.strokes[index];
            if (target?.type === 'solid') target.color = color;
            if (index === 0) value.stroke = color;
          }),
        notify,
      );
      inputField(
        section,
        `Stroke ${index + 1} width`,
        stroke.width,
        'number',
        (width) =>
          updateAndRender((value) => {
            value.strokes = strokes(value);
            value.strokes[index]!.width = Number(width);
            if (index === 0) value.strokeWidth = Number(width);
          }),
        notify,
      );
      inputField(
        section,
        `Stroke ${index + 1} opacity`,
        stroke.opacity,
        'number',
        (opacity) =>
          updateAndRender((value) => {
            value.strokes = strokes(value);
            value.strokes[index]!.opacity = Number(opacity);
            if (index === 0) value.strokeOpacity = Number(opacity);
          }),
        notify,
      );
      section.append(
        button(
          `Remove stroke ${index + 1}`,
          () =>
            updateAndRender((value) => {
              value.strokes = strokes(value);
              value.strokes.splice(index, 1);
              const first = value.strokes[0];
              value.stroke = first?.type === 'solid' ? first.color : value.stroke;
              value.strokeWidth = first?.width ?? 0;
              value.strokeOpacity = first?.opacity ?? 1;
            }),
          notify,
        ),
      );
      content.append(section);
    });
    content.append(
      button(
        'Add stroke',
        () =>
          updateAndRender((value) => {
            value.strokes = [
              ...strokes(value),
              { type: 'solid', color: '#000000', opacity: 1, width: 1 },
            ];
          }),
        notify,
      ),
    );
    dialog.replaceChildren(heading, content);
  };
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  document.body.append(dialog);
  render();
  dialog.showModal();
  dialog.querySelector<HTMLElement>('input, button')?.focus();
}
