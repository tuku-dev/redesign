import { renderDesignOptions } from './design-options.ts';
import { renderParentControl } from './parent-control.ts';
import type { EditorStore } from '../editor/store.ts';
import type { EditingCommands } from '../commands/editing.ts';
import type { ClipboardController } from '../interop/clipboard-controller.ts';
import type { Alignment, Axis, DesignNode, EditableProperty } from '../model/types.ts';
import type { Notify } from './notifications.ts';
import { errorMessage } from './elements.ts';
import { actionButton } from './action-button.ts';
import { cornerRadii } from '../model/geometry.ts';
import { bindNumberScrub } from './numeric-scrub.ts';
import { createIcon } from './icons.ts';
import { toolCursor } from '../render/cursors.ts';
import type { IconName } from './icons.ts';
import type { CornerName } from '../model/types.ts';
import { bindColorPreview } from './color-preview.ts';
import { selectedNodes } from '../model/selection.ts';
import { FeatureCommands } from '../commands/features.ts';
import { defaultAppearance } from '../model/features.ts';
import { isLocked } from '../model/layer-state.ts';
type Field = readonly [EditableProperty, string, 'number' | 'text' | 'color'];
function cornerControl(key: EditableProperty): { corner: CornerName; icon: IconName } | undefined {
  if (key === 'topLeftRadius') return { corner: 'topLeft', icon: 'cornerTopLeft' };
  if (key === 'topRightRadius') return { corner: 'topRight', icon: 'cornerTopRight' };
  if (key === 'bottomRightRadius') return { corner: 'bottomRight', icon: 'cornerBottomRight' };
  if (key === 'bottomLeftRadius') return { corner: 'bottomLeft', icon: 'cornerBottomLeft' };
  return undefined;
}
function propertyValue(node: DesignNode, key: EditableProperty): number | string | undefined {
  if (key === 'radius') {
    const values = Object.values(cornerRadii(node));
    return values.every((value) => value === values[0]) ? values[0] : undefined;
  }
  const radii = cornerRadii(node);
  if (key === 'topLeftRadius') return radii.topLeft;
  if (key === 'topRightRadius') return radii.topRight;
  if (key === 'bottomRightRadius') return radii.bottomRight;
  if (key === 'bottomLeftRadius') return radii.bottomLeft;
  return node[key];
}
export function renderProperties(
  area: HTMLElement,
  store: EditorStore,
  commands: EditingCommands,
  clipboard: ClipboardController,
  notify: Notify,
  canvas: SVGSVGElement,
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
  const canRoundCorners = nodes.every(
    (item) => item.type === 'rectangle' || item.type === 'frame' || item.vector?.closed,
  );
  const fields: Field[] = multi
    ? [
        ...(canRoundCorners ? [['radius', 'Radius', 'number'] as const] : []),
        ['opacity', 'Opacity', 'number'],
        ['fill', 'Fill', 'color'],
      ]
    : [
        ['name', 'Name', 'text'],
        ['x', 'X', 'number'],
        ['y', 'Y', 'number'],
        ['width', 'W', 'number'],
        ['height', 'H', 'number'],
        ...(canRoundCorners ? [['radius', 'Radius', 'number'] as const] : []),
        ['opacity', 'Opacity', 'number'],
        ['fill', 'Fill', 'color'],
      ];
  if (!multi && (n.type === 'rectangle' || n.type === 'frame'))
    fields.splice(
      6,
      0,
      ['topLeftRadius', 'Top-left radius', 'number'],
      ['topRightRadius', 'Top-right radius', 'number'],
      ['bottomRightRadius', 'Bottom-right radius', 'number'],
      ['bottomLeftRadius', 'Bottom-left radius', 'number'],
    );
  if (nodes.every((item) => item.type === 'text')) fields.push(['fontSize', 'Size', 'number']);
  const supportsStroke = nodes.every((item) => item.type !== 'group'),
    featureCommands = new FeatureCommands(store);
  let fillControl: HTMLElement | undefined;
  for (const [key, label, type] of fields) {
    const corner = cornerControl(key),
      canvasColor = key === 'fill',
      wrap = document.createElement(corner || canvasColor ? 'div' : 'label');
    wrap.className =
      'field' +
      (key === 'name' ? ' full' : '') +
      (corner ? ' corner-radius-field' : '') +
      (canvasColor ? ' canvas-color-field' : '');
    const caption = document.createElement('span');
    caption.textContent = label;
    const input = document.createElement('input');
    input.type = type;
    input.setAttribute('aria-label', label);
    const value = propertyValue(n, key),
      mixed = value === undefined || nodes.some((item) => propertyValue(item, key) !== value);
    if (mixed && type !== 'color') {
      input.value = '';
      input.placeholder = 'Mixed';
    } else input.value = String(value);
    if (mixed && type === 'color') {
      caption.textContent = 'Mixed';
      input.title = 'Mixed fill';
    }
    if (type === 'number') {
      input.step = key === 'opacity' ? '0.1' : '1';
      if (['width', 'height', 'fontSize'].includes(key)) input.min = '1';
      if (key === 'opacity') {
        input.min = '0';
        input.max = '1';
      }
      if (key.toLowerCase().includes('radius')) input.min = '0';
      bindNumberScrub(caption, input);
    }
    if (type === 'color' && key === 'fill')
      bindColorPreview(
        input,
        store,
        (color) => {
          store.canvasPaintColor = color;
          selectedNodes(store.doc, store.selected).forEach((node) => (node.fill = color));
        },
        notify,
      );
    if (canvasColor) {
      input.title = 'Fill color';
      for (const [mode, iconName, label] of [['apply', 'paint', 'Apply fill']] as const) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'canvas-color-mode';
        button.title = label;
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', String(store.canvasColorMode === mode));
        button.append(createIcon(iconName));
        button.onclick = () => {
          store.canvasColorMode = store.canvasColorMode === mode ? null : mode;
          store.canvasPaintColor = input.value;
          store.refresh('all');
          if (store.canvasColorMode) canvas.style.cursor = toolCursor(store);
        };
        wrap.append(button);
      }
    }
    if (corner) {
      const icon = document.createElement('button');
      icon.type = 'button';
      icon.className = 'corner-radius-icon';
      icon.title = label;
      icon.setAttribute('aria-label', `Select ${label.toLowerCase()} corner`);
      icon.setAttribute('aria-pressed', String(store.cornerRadiusCorner === corner.corner));
      icon.append(createIcon(corner.icon));
      icon.onclick = () => {
        store.cornerRadiusCorner =
          store.cornerRadiusCorner === corner.corner ? null : corner.corner;
        store.refresh('all');
      };
      input.setAttribute('aria-label', label);
      input.title = label;
      wrap.append(icon, input);
    }
    input.onchange = () => {
      if (type === 'color' && key === 'fill') return;
      if (type === 'number' && input.value === '') return;
      try {
        commands.setProperty(key, type === 'number' ? Number(input.value) : input.value);
      } catch (error) {
        notify(errorMessage(error));
        renderProperties(area, store, commands, clipboard, notify, canvas);
      }
    };
    if (!corner) wrap.prepend(caption, input);
    if (canvasColor) fillControl = wrap;
    else grid.append(wrap);
  }
  if (supportsStroke) {
    const appearance = n.appearance ?? defaultAppearance(),
      stroke = document.createElement('div'),
      caption = document.createElement('span'),
      enabled = document.createElement('input'),
      color = document.createElement('input'),
      width = document.createElement('input'),
      widthCaption = document.createElement('span'),
      disabled = nodes.every((node) => isLocked(store.doc, node));
    stroke.className = 'field stroke-field';
    caption.textContent = 'Stroke';
    enabled.type = 'checkbox';
    enabled.checked = appearance.strokeWidth > 0;
    enabled.setAttribute('aria-label', 'Enable stroke');
    enabled.title = 'Enable stroke';
    color.type = 'color';
    color.value = appearance.stroke;
    color.setAttribute('aria-label', 'Stroke color');
    color.title = 'Stroke color';
    width.type = 'number';
    width.min = '0';
    width.step = 'any';
    width.value = String(appearance.strokeWidth);
    width.setAttribute('aria-label', 'Stroke width');
    width.title = 'Stroke width';
    widthCaption.textContent = 'Width';
    bindNumberScrub(widthCaption, width);
    enabled.disabled = disabled;
    color.disabled = disabled;
    width.disabled = disabled;
    const updateStroke = (action: (value: ReturnType<typeof defaultAppearance>) => void) => {
      const next = structuredClone(appearance);
      action(next);
      featureCommands.appearance(next);
    };
    bindColorPreview(
      color,
      store,
      (value) =>
        selectedNodes(store.doc, store.selected)
          .filter((node) => !isLocked(store.doc, node))
          .forEach((node) => {
            node.appearance = {
              ...(node.appearance ?? defaultAppearance()),
              stroke: value,
            };
          }),
      notify,
    );
    enabled.onchange = () =>
      updateStroke((value) => {
        value.strokeWidth = enabled.checked ? Math.max(1, value.strokeWidth) : 0;
      });
    width.onchange = () => {
      if (width.value === '') return;
      updateStroke((value) => (value.strokeWidth = Number(width.value)));
    };
    stroke.append(caption, enabled, color, widthCaption, width);
    if (fillControl) grid.append(fillControl);
    grid.append(stroke);
  } else if (fillControl) {
    grid.append(fillControl);
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
