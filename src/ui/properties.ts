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
import type { IconName } from './icons.ts';
import type { CornerName } from '../model/types.ts';
import { selectionRoots } from '../model/hierarchy.ts';
import { FeatureCommands } from '../commands/features.ts';
import { defaultAppearance } from '../model/features.ts';
import type { Appearance, Paint, StrokePaint } from '../model/features.ts';
import { button } from './feature-controls.ts';
import { openPaintEditor } from './paint-editor.ts';
type Field = readonly [EditableProperty, string, 'number' | 'text' | 'color'];

function firstFill(appearance: Appearance, fill: string): Paint {
  return (
    appearance.fills?.[0] ?? {
      type: 'solid',
      color: fill,
      opacity: appearance.fillOpacity ?? 1,
    }
  );
}

function firstStroke(appearance: Appearance): StrokePaint {
  return (
    appearance.strokes?.[0] ?? {
      type: 'solid',
      color: appearance.stroke,
      opacity: appearance.strokeOpacity ?? 1,
      width: appearance.strokeWidth || 1,
    }
  );
}

function linearGradient(color: string, opacity: number): Paint {
  return {
    type: 'linear',
    opacity,
    stops: [
      { color: color || '#000000', opacity: 1, position: 0 },
      { color: '#ffffff', opacity: 1, position: 1 },
    ],
    start: { x: 0, y: 0.5 },
    end: { x: 1, y: 0.5 },
  };
}

function paintPreview(paint: Paint): string {
  if (paint.type === 'solid') return paint.color;
  return `linear-gradient(90deg, ${paint.stops
    .map((stop) => `${stop.color} ${Math.max(0, Math.min(1, stop.position)) * 100}%`)
    .join(', ')})`;
}

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
function displayNumber(value: number): string {
  const scaled = value * 100,
    adjustment = Math.sign(value) * Number.EPSILON * Math.abs(value) * 100;
  return String(Math.trunc(scaled + adjustment) / 100);
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
    geometryNodes = multi ? selectionRoots(store.doc, store.selected) : [n],
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
  const canRoundCorners = nodes.every((item) => item.type === 'rectangle' || item.vector?.closed);
  const fields: Field[] = multi
    ? [
        ['x', 'X', 'number'],
        ['y', 'Y', 'number'],
        ['width', 'W', 'number'],
        ['height', 'H', 'number'],
        ...(canRoundCorners ? [['radius', 'Radius', 'number'] as const] : []),
        ['opacity', 'Opacity', 'number'],
      ]
    : [
        ['name', 'Name', 'text'],
        ['x', 'X', 'number'],
        ['y', 'Y', 'number'],
        ['width', 'W', 'number'],
        ['height', 'H', 'number'],
        ...(canRoundCorners ? [['radius', 'Radius', 'number'] as const] : []),
        ['opacity', 'Opacity', 'number'],
      ];
  if (!multi && n.type === 'rectangle')
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
  for (const [key, label, type] of fields) {
    const corner = cornerControl(key),
      wrap = document.createElement(corner ? 'div' : 'label');
    wrap.className =
      'field' + (key === 'name' ? ' full' : '') + (corner ? ' corner-radius-field' : '');
    const caption = document.createElement('span');
    caption.textContent = label;
    const input = document.createElement('input');
    input.type = type;
    input.setAttribute('aria-label', label);
    const values = ['x', 'y', 'width', 'height'].includes(key) ? geometryNodes : nodes;
    const value = propertyValue(values[0] ?? n, key),
      mixed = value === undefined || values.some((item) => propertyValue(item, key) !== value);
    if (mixed && type !== 'color') {
      input.value = '';
      input.placeholder = 'Mixed';
    } else
      input.value =
        type === 'number' && typeof value === 'number' ? displayNumber(value) : String(value);
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
    grid.append(wrap);
  }
  if (!multi && supportsStroke) {
    const paints = document.createElement('div');
    paints.className = 'property-group';
    const heading = document.createElement('h3');
    heading.textContent = 'Paint';
    paints.append(heading);
    const appearance = n.appearance ?? defaultAppearance();
    const target = store.paintTarget;
    const updateAppearance = (action: (value: Appearance) => void) => {
      const current = store.doc.nodes.find((node) => node.id === n.id);
      if (!current) return;
      const next = structuredClone(current.appearance ?? defaultAppearance());
      action(next);
      featureCommands.appearance(next);
    };
    const replacePaint = (value: Appearance, paint: Paint | StrokePaint) => {
      if (target === 'fill') {
        value.fills = [paint, ...(value.fills?.slice(1) ?? [])];
        return;
      }
      if (!('width' in paint)) throw new Error('Border paints require a width.');
      value.strokes = [paint, ...(value.strokes?.slice(1) ?? [])];
    };
    const currentPaint =
      target === 'fill' ? firstFill(appearance, n.fill) : firstStroke(appearance);
    const paintModes = document.createElement('div');
    paintModes.className = 'paint-mode-switch';
    for (const [mode, label] of [
      ['solid', 'Solid color'],
      ['gradient', 'Gradient'],
    ] as const) {
      const selected =
        mode === 'solid' ? currentPaint.type === 'solid' : currentPaint.type !== 'solid';
      const control = button(
        label,
        () =>
          updateAppearance((value) => {
            const current = target === 'fill' ? firstFill(value, n.fill) : firstStroke(value);
            if (mode === 'solid') {
              const color = current.type === 'solid' ? current.color : current.stops[0]?.color;
              const solid = {
                type: 'solid' as const,
                color: color || '#000000',
                opacity: current.opacity,
              };
              replacePaint(
                value,
                target === 'fill' ? solid : { ...solid, width: firstStroke(value).width },
              );
            } else {
              const color = current.type === 'solid' ? current.color : current.stops[0]?.color;
              const gradient = linearGradient(color || '#000000', current.opacity);
              replacePaint(
                value,
                target === 'fill' ? gradient : { ...gradient, width: firstStroke(value).width },
              );
            }
          }),
        notify,
      );
      control.className = 'paint-mode-option';
      control.textContent = '';
      control.setAttribute('aria-label', label);
      control.title = label;
      control.setAttribute('aria-pressed', String(selected));
      control.style.background =
        mode === 'solid'
          ? currentPaint.type === 'solid'
            ? currentPaint.color
            : (currentPaint.stops[0]?.color ?? '#000000')
          : currentPaint.type === 'solid'
            ? paintPreview(linearGradient(currentPaint.color, currentPaint.opacity))
            : paintPreview(currentPaint);
      paintModes.append(control);
    }
    paints.append(paintModes);
    const targets = document.createElement('div');
    targets.className = 'paint-target-switch';
    for (const [value, label] of [
      ['fill', 'Fill'],
      ['border', 'Border'],
    ] as const) {
      const control = button(
        label,
        () => {
          store.paintTarget = value;
          store.refresh();
        },
        notify,
      );
      control.className = 'paint-target-option';
      control.textContent = '';
      control.setAttribute('aria-label', label);
      control.title = label;
      control.setAttribute('aria-pressed', String(target === value));
      control.style.background = paintPreview(
        value === 'fill' ? firstFill(appearance, n.fill) : firstStroke(appearance),
      );
      targets.append(control);
    }
    paints.append(targets);
    if (currentPaint.type === 'solid') {
      const label = target === 'fill' ? 'Fill color' : 'Border color';
      const color = document.createElement('label');
      color.className = 'feature-field';
      const caption = document.createElement('span');
      caption.textContent = label;
      const input = document.createElement('input');
      input.type = 'color';
      input.value = currentPaint.color;
      input.setAttribute('aria-label', label);
      input.onchange = () =>
        updateAppearance((value) => {
          const current = target === 'fill' ? firstFill(value, n.fill) : firstStroke(value);
          if (current.type === 'solid') current.color = input.value;
          replacePaint(value, current);
        });
      color.append(caption, input);
      paints.append(color);
    }
    if (target === 'border') {
      const width = document.createElement('label');
      width.className = 'feature-field';
      const caption = document.createElement('span');
      caption.textContent = 'Border width';
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = 'any';
      input.value = String(firstStroke(appearance).width);
      input.setAttribute('aria-label', 'Border width');
      bindNumberScrub(caption, input);
      input.onchange = () =>
        updateAppearance((value) => {
          const current = firstStroke(value);
          current.width = Number(input.value);
          replacePaint(value, current);
        });
      width.append(caption, input);
      paints.append(width);
    }
    paints.append(
      button(
        'Edit paints',
        () =>
          openPaintEditor({
            fill: n.fill,
            getAppearance: () =>
              store.doc.nodes.find((node) => node.id === n.id)?.appearance ?? defaultAppearance(),
            update: updateAppearance,
            notify,
          }),
        notify,
      ),
    );
    group.append(paints);
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
    heading.textContent = 'Align';
    alignment.append(heading);
    const alignModes: readonly (readonly [Alignment, string, IconName])[] = [
      ['left', 'Align left', 'alignLeft'],
      ['center', 'Align horizontal centers', 'alignCenterX'],
      ['right', 'Align right', 'alignRight'],
      ['top', 'Align top', 'alignTop'],
      ['middle', 'Align vertical centers', 'alignCenterY'],
      ['bottom', 'Align bottom', 'alignBottom'],
    ];
    const distributeModes: readonly (readonly [Alignment, string, IconName])[] = [
      ['left', 'Distribute left edges', 'distributeLeft'],
      ['center', 'Distribute horizontal centers', 'distributeCenterX'],
      ['right', 'Distribute right edges', 'distributeRight'],
      ['top', 'Distribute top edges', 'distributeTop'],
      ['middle', 'Distribute vertical centers', 'distributeCenterY'],
      ['bottom', 'Distribute bottom edges', 'distributeBottom'],
    ];
    const addControlGroup = (
      title: string,
      className: string,
      controls: readonly (readonly [string, IconName, () => void])[],
      disabled = false,
    ) => {
      const group = document.createElement('div');
      group.className = 'alignment-control-group';
      const label = document.createElement('h4');
      label.textContent = title;
      const buttons = document.createElement('div');
      buttons.className = className;
      for (const [accessibleName, icon, action] of controls) {
        const b = document.createElement('button');
        b.setAttribute('aria-label', accessibleName);
        b.title = accessibleName;
        b.disabled = disabled;
        b.append(createIcon(icon));
        b.onclick = action;
        buttons.append(b);
      }
      group.append(label, buttons);
      alignment.append(group);
    };
    addControlGroup(
      'Align Objects',
      'alignment-controls',
      alignModes.map(([mode, label, icon]) => [label, icon, () => commands.align(mode)]),
    );
    addControlGroup(
      'Distribute Objects',
      'alignment-controls',
      distributeModes.map(([mode, label, icon]) => [
        label,
        icon,
        () => commands.distributeAligned(mode),
      ]),
      nodes.length < 3,
    );
    const spacingModes: readonly (readonly [Axis, string, IconName])[] = [
      ['x', 'Distribute horizontal spacing', 'justifyHorizontal'],
      ['y', 'Distribute vertical spacing', 'justifyVertical'],
    ];
    addControlGroup(
      'Distribute Spacing',
      'alignment-spacing-controls',
      spacingModes.map(([axis, label, icon]) => [label, icon, () => commands.distribute(axis)]),
      nodes.length < 3,
    );
    area.append(alignment);
  }
  area.append(group, actions);
}
