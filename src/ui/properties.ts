import { renderDesignOptions } from './design-options.ts';
import { renderParentControl } from './parent-control.ts';
import type { EditorStore } from '../editor/store.ts';
import type { EditingCommands } from '../commands/editing.ts';
import type { ClipboardController } from '../interop/clipboard-controller.ts';
import type { Alignment, Axis, EditableProperty } from '../model/types.ts';
import type { Notify } from './notifications.ts';
import { errorMessage } from './elements.ts';
import { actionButton } from './action-button.ts';
type Field = readonly [EditableProperty, string, 'number' | 'text' | 'color'];
export function renderProperties(
  area: HTMLElement,
  store: EditorStore,
  commands: EditingCommands,
  clipboard: ClipboardController,
  notify: Notify,
): void {
  area.replaceChildren();
  const nodes = store.chosen(),
    n = nodes[0];
  if (!n) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent =
      'Select a layer to edit it. Shift-click to select more, or drag on empty canvas to select an area.';
    area.append(p);
    if (clipboard.nodes.length) {
      const actions = document.createElement('div');
      actions.className = 'property-group';
      actions.append(actionButton('Paste layers', 'duplicate', () => clipboard.paste()));
      area.append(actions);
    }
    return;
  }
  const multi = nodes.length > 1,
    group = document.createElement('div');
  group.className = 'property-group';
  const title = document.createElement('h3');
  title.textContent = multi
    ? `${nodes.length} layers selected`
    : n.type[0].toUpperCase() + n.type.slice(1);
  group.append(title);
  renderParentControl(group, store, commands, notify);
  const grid = document.createElement('div');
  grid.className = 'property-grid';
  group.append(grid);
  const fields: Field[] = multi
    ? [
        ['radius', 'Radius', 'number'],
        ['opacity', 'Opacity', 'number'],
        ['fill', 'Fill', 'color'],
      ]
    : [
        ['name', 'Name', 'text'],
        ['x', 'X', 'number'],
        ['y', 'Y', 'number'],
        ['width', 'W', 'number'],
        ['height', 'H', 'number'],
        ['radius', 'Radius', 'number'],
        ['opacity', 'Opacity', 'number'],
        ['fill', 'Fill', 'color'],
      ];
  if (nodes.every((item) => item.type === 'text')) fields.push(['fontSize', 'Size', 'number']);
  for (const [key, label, type] of fields) {
    const wrap = document.createElement('label');
    wrap.className = 'field' + (key === 'name' ? ' full' : '');
    const caption = document.createElement('span');
    caption.textContent = label;
    const input = document.createElement('input');
    input.type = type;
    input.setAttribute('aria-label', label);
    const mixed = nodes.some((item) => item[key] !== n[key]);
    if (mixed && type !== 'color') {
      input.value = '';
      input.placeholder = 'Mixed';
    } else input.value = String(n[key]);
    if (mixed && type === 'color') {
      caption.textContent = 'Mixed';
      input.title = 'Mixed fills - choose a color to apply to all selected layers';
    }
    if (type === 'number') {
      input.step = key === 'opacity' ? '0.1' : '1';
      if (['width', 'height', 'fontSize'].includes(key)) input.min = '1';
      if (key === 'opacity') {
        input.min = '0';
        input.max = '1';
      }
      if (key === 'radius') input.min = '0';
    }
    input.onchange = () => {
      if (type === 'number' && input.value === '') return;
      try {
        commands.setProperty(key, type === 'number' ? Number(input.value) : input.value);
      } catch (error) {
        notify(errorMessage(error));
        renderProperties(area, store, commands, clipboard, notify);
      }
    };
    wrap.append(caption, input);
    grid.append(wrap);
  }
  if (!multi && n.type === 'text') {
    const text = document.createElement('textarea');
    text.value = n.text;
    text.setAttribute('aria-label', 'Text content');
    text.onchange = () => commands.setText(text.value);
    group.append(document.createElement('br'), text);
  }
  renderDesignOptions(group, store, notify);
  const actions = document.createElement('div');
  actions.className = 'property-group';
  actions.append(
    actionButton('Duplicate', 'duplicate', () => commands.duplicate()),
    actionButton('Copy', 'duplicate', () => clipboard.copy()),
    actionButton('Paste', 'duplicate', () => clipboard.paste()),
    actionButton('Delete', 'delete', () => commands.remove()),
  );
  if (!multi)
    actions.append(
      actionButton('Bring forward', 'forward', () => commands.reorder(1)),
      actionButton('Send backward', 'backward', () => commands.reorder(-1)),
    );
  if (multi) {
    const alignment = document.createElement('div');
    alignment.className = 'property-group';
    const heading = document.createElement('h3');
    heading.textContent = 'Align selection';
    alignment.append(heading);
    const controls = document.createElement('div');
    controls.className = 'alignment-controls';
    const modes: readonly (readonly [Alignment, string])[] = [
      ['left', 'Left'],
      ['center', 'Center X'],
      ['right', 'Right'],
      ['top', 'Top'],
      ['middle', 'Center Y'],
      ['bottom', 'Bottom'],
    ];
    for (const [mode, label] of modes) {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = 'Align ' + label.toLowerCase();
      b.onclick = () => commands.align(mode);
      controls.append(b);
    }
    const axes: readonly (readonly [Axis, string])[] = [
      ['x', 'Distribute horizontally'],
      ['y', 'Distribute vertically'],
    ];
    for (const [axis, label] of axes) {
      const b = document.createElement('button');
      b.textContent = label;
      b.disabled = nodes.length < 3;
      b.onclick = () => commands.distribute(axis);
      controls.append(b);
    }
    alignment.append(controls);
    area.append(alignment);
  }
  area.append(group, actions);
}
