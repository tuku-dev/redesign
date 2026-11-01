import type { Appearance, GradientPaint } from '../model/features.ts';
import type { Notify } from './notifications.ts';
import { button, inputField } from './feature-controls.ts';
import { createIcon } from './icons.ts';

interface GradientEditorOptions {
  fillIndex: number;
  getAppearance: () => Appearance;
  update: (action: (value: Appearance) => void) => void;
  remove: () => void;
  onClose?: () => void;
  host?: HTMLElement;
  notify: Notify;
}

/**
 * Renders gradient controls either in the paint editor row or in a standalone dialog.
 * Stops are addressed by their current sorted position because persisted stops
 * deliberately do not have editor-only IDs.
 */
export function openGradientEditor(options: GradientEditorOptions): void {
  renderGradientEditor(options);
}

export function renderGradientEditor(options: GradientEditorOptions): void {
  const { fillIndex, getAppearance, update, remove, notify, onClose } = options;
  const dialog = options.host ? undefined : document.createElement('dialog');
  const host = options.host ?? dialog!;
  if (dialog) {
    dialog.className = 'gradient-editor';
    dialog.setAttribute('aria-labelledby', 'gradient-editor-title');
  }
  const previous = document.activeElement as HTMLElement | null;
  let selectedStop = 0;

  const close = () => {
    dialog?.close();
    dialog?.remove();
    previous?.focus();
    onClose?.();
  };
  const set = (action: (gradient: GradientPaint) => number | void, rerender = true) => {
    let nextSelected = selectedStop;
    update((appearance) => {
      const gradient = appearance.fills?.[fillIndex];
      if (!gradient || gradient.type === 'solid') return;
      nextSelected = action(gradient) ?? selectedStop;
    });
    selectedStop = nextSelected;
    if (rerender) render();
  };
  const paintTrack = (track: HTMLElement, gradient: GradientPaint) => {
    track.style.background = `linear-gradient(90deg, ${gradient.stops
      .map((stop) => `${stop.color} ${Math.max(0, Math.min(1, stop.position)) * 100}%`)
      .join(', ')})`;
  };
  const addStop = (position: number) =>
    set((value) => {
      const stop = { color: '#ffffff', opacity: 1, position };
      value.stops.push(stop);
      value.stops.sort((a, b) => a.position - b.position);
      return value.stops.indexOf(stop);
    });
  const render = () => {
    const gradient = getAppearance().fills?.[fillIndex];
    if (!gradient || gradient.type === 'solid') {
      close();
      return;
    }
    selectedStop = Math.min(selectedStop, gradient.stops.length - 1);
    const selected = gradient.stops[selectedStop]!;
    const header = document.createElement('div');
    if (dialog) {
      header.className = 'gradient-editor-header';
      const title = document.createElement('h2');
      title.id = 'gradient-editor-title';
      title.textContent = 'Gradient';
      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'gradient-editor-close';
      closeButton.setAttribute('aria-label', 'Close gradient editor');
      closeButton.title = 'Close gradient editor';
      closeButton.append(createIcon('close'));
      closeButton.onclick = close;
      header.append(title, closeButton);
    }

    const types = document.createElement('fieldset');
    types.className = 'gradient-types';
    types.setAttribute('aria-label', `Fill ${fillIndex + 1} gradient type`);
    for (const [type, label] of [
      ['linear', 'Linear'],
      ['radial', 'Radial'],
    ] as const) {
      const control = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `gradient-type-${fillIndex}`;
      input.value = type;
      input.checked = gradient.type === type;
      input.setAttribute('aria-label', `${label} gradient`);
      input.onchange = () =>
        set((value) => {
          value.type = type;
          if (type === 'radial') value.radius ??= { x: 0.5, y: 1 };
          else delete value.radius;
        }, false);
      control.append(input, document.createTextNode(label));
      types.append(control);
    }
    const mesh = document.createElement('label');
    const meshInput = document.createElement('input');
    meshInput.type = 'radio';
    meshInput.disabled = true;
    meshInput.setAttribute('aria-label', 'Mesh gradient (not yet supported)');
    meshInput.title = 'Mesh gradients are not yet supported';
    mesh.append(meshInput, document.createTextNode('Mesh (not yet supported)'));
    types.append(mesh);

    const stops = document.createElement('div');
    stops.className = 'gradient-stop-track';
    stops.setAttribute('role', 'group');
    stops.setAttribute('aria-label', 'Gradient stops. Click the track to add a stop');
    stops.setAttribute('aria-description', 'Press Enter or Space to add a stop at the middle.');
    stops.tabIndex = 0;
    const positionAt = (clientX: number) => {
      const bounds = stops.getBoundingClientRect();
      return bounds.width ? Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)) : 0.5;
    };
    stops.onclick = (event) => {
      if (event.target === stops) addStop(positionAt(event.clientX));
    };
    stops.onkeydown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      addStop(0.5);
    };
    paintTrack(stops, gradient);
    for (const [index, stop] of gradient.stops.entries()) {
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'gradient-stop-handle';
      handle.style.left = `${Math.max(0, Math.min(1, stop.position)) * 100}%`;
      handle.style.setProperty('--stop-color', stop.color);
      handle.setAttribute('aria-label', `Fill ${fillIndex + 1} stop ${index + 1}`);
      handle.setAttribute('aria-pressed', String(index === selectedStop));
      handle.title = `Select stop ${index + 1}`;
      let ignoreClick = false;
      handle.onclick = () => {
        if (ignoreClick) {
          ignoreClick = false;
          return;
        }
        selectedStop = index;
        render();
      };
      handle.onpointerdown = (event) => {
        if (event.button !== 0) return;
        selectedStop = index;
        color.value = stop.color;
        opacity.value = String(stop.opacity);
        location.value = String(stop.position);
        stops
          .querySelectorAll<HTMLButtonElement>('.gradient-stop-handle')
          .forEach((item, itemIndex) =>
            item.setAttribute('aria-pressed', String(itemIndex === index)),
          );
        handle.setPointerCapture(event.pointerId);
        let moved = false;
        const move = (moveEvent: PointerEvent) => {
          moved = true;
          const position = positionAt(moveEvent.clientX);
          set((value) => {
            const target = value.stops[selectedStop]!;
            target.position = position;
            value.stops.sort((a, b) => a.position - b.position);
            return value.stops.indexOf(target);
          }, false);
          handle.style.left = `${position * 100}%`;
          const current = getAppearance().fills?.[fillIndex];
          if (current && current.type !== 'solid') paintTrack(stops, current);
          location.value = String(position);
        };
        const finish = (upEvent: PointerEvent) => {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', finish);
          handle.removeEventListener('pointercancel', finish);
          if (handle.hasPointerCapture(upEvent.pointerId))
            handle.releasePointerCapture(upEvent.pointerId);
          if (moved) {
            ignoreClick = true;
            render();
          }
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', finish);
        handle.addEventListener('pointercancel', finish);
      };
      stops.append(handle);
    }

    const colorPanel = document.createElement('div');
    colorPanel.className = 'gradient-color-panel';
    colorPanel.setAttribute('role', 'group');
    colorPanel.setAttribute('aria-label', 'Selected stop color panel');
    const color = inputField(
      colorPanel,
      'Color',
      selected.color,
      'color',
      (color) =>
        set((value) => {
          value.stops[selectedStop]!.color = color;
        }),
      notify,
    );
    const controls = document.createElement('div');
    controls.className = 'gradient-stop-controls';
    inputField(
      controls,
      'Gradient opacity',
      gradient.opacity,
      'number',
      (opacity) =>
        set((value) => {
          value.opacity = Number(opacity);
        }),
      notify,
    );
    const opacity = inputField(
      controls,
      'Gradient stop opacity',
      selected.opacity,
      'number',
      (opacity) =>
        set((value) => {
          value.stops[selectedStop]!.opacity = Number(opacity);
        }),
      notify,
    );
    const location = inputField(
      controls,
      'Gradient stop location',
      selected.position,
      'number',
      (position) =>
        set((value) => {
          const stop = value.stops[selectedStop]!;
          stop.position = Number(position);
          value.stops.sort((a, b) => a.position - b.position);
          return value.stops.indexOf(stop);
        }),
      notify,
    );
    const actions = document.createElement('div');
    actions.className = 'gradient-editor-actions';
    actions.append(
      button(
        'Remove gradient',
        () => {
          remove();
          close();
        },
        notify,
      ),
    );
    if (gradient.stops.length > 2)
      actions.append(
        button(
          'Remove selected gradient stop',
          () =>
            set((value) => {
              value.stops.splice(selectedStop, 1);
              return Math.min(selectedStop, value.stops.length - 1);
            }),
          notify,
        ),
      );
    host.replaceChildren(
      ...(dialog ? [header] : []),
      types,
      stops,
      colorPanel,
      controls,
      ...(actions.childElementCount ? [actions] : []),
    );
  };
  if (dialog) {
    dialog.addEventListener('keydown', (event) => event.stopPropagation());
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close();
    });
    document.body.append(dialog);
  }
  render();
  if (dialog) {
    dialog.showModal();
    dialog.querySelector<HTMLElement>('input, button')?.focus();
  }
}
