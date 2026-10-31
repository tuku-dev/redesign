import type { AutoLayout } from '../model/features.ts';
import type { EditorStore } from '../editor/store.ts';
import type { Notify } from './notifications.ts';
import { FeatureCommands } from '../commands/features.ts';
import { defaultAppearance, defaultGrid } from '../model/features.ts';
import { clone } from '../model/types.ts';
import { isLocked } from '../model/layer-state.ts';
import { allNodes } from '../model/workspace.ts';
import { section, button, inputField, selectField, checkbox } from './feature-controls.ts';
export function renderFeatureProperties(
  area: HTMLElement,
  store: EditorStore,
  notify: Notify,
): void {
  const n = store.current();
  if (!n) return;
  const command = new FeatureCommands(store),
    container = document.createElement('fieldset');
  container.className = 'feature-properties';
  container.disabled = store.chosen().some((n) => isLocked(store.doc, n));
  if (store.chosen().length === 1) {
    const layout = section('Auto layout');
    if (n.type === 'frame' && n.layout) {
      const set = (action: (v: AutoLayout) => void) => {
        const value = clone(n.layout!);
        action(value);
        command.layout(value);
      };
      selectField(
        layout,
        'Direction',
        n.layout.direction,
        [
          ['horizontal', 'Horizontal'],
          ['vertical', 'Vertical'],
        ],
        (v) => set((l) => (l.direction = v as 'horizontal' | 'vertical')),
        notify,
      );
      inputField(
        layout,
        'Gap',
        n.layout.gap,
        'number',
        (v) => set((l) => (l.gap = Number(v))),
        notify,
      );
      for (const edge of ['top', 'right', 'bottom', 'left'] as const)
        inputField(
          layout,
          `Padding ${edge}`,
          n.layout.padding[edge],
          'number',
          (v) => set((l) => (l.padding[edge] = Number(v))),
          notify,
        );
      selectField(
        layout,
        'Cross alignment',
        n.layout.align,
        [
          ['start', 'Start'],
          ['center', 'Center'],
          ['end', 'End'],
        ],
        (v) => set((l) => (l.align = v as 'start' | 'center' | 'end')),
        notify,
      );
      selectField(
        layout,
        'Distribution',
        n.layout.justify,
        [
          ['start', 'Start'],
          ['center', 'Center'],
          ['end', 'End'],
          ['space-between', 'Space between'],
        ],
        (v) => set((l) => (l.justify = v as 'start' | 'center' | 'end' | 'space-between')),
        notify,
      );
      layout.append(button('Remove auto layout', () => command.layout(undefined), notify));
    } else layout.append(button('Add auto layout', () => command.addLayout(), notify));
    const sizing = n.sizing ?? { width: 'fixed', height: 'fixed' };
    if (n.layout || store.doc.nodes.find((p) => p.id === n.parentId)?.layout) {
      for (const axis of ['width', 'height'] as const)
        selectField(
          layout,
          `Layout ${axis}`,
          sizing[axis],
          [
            ['fixed', 'Fixed'],
            ...(n.layout ? [['hug', 'Hug contents'] as const] : []),
            ['fill', 'Fill container'],
          ],
          (v) => command.sizing({ ...sizing, [axis]: v }),
          notify,
        );
    }
    container.append(layout);
    const components = section('Component');
    if (n.component?.kind === 'main')
      components.append(button('Create instance', () => command.instantiate(), notify));
    else if (n.component?.kind === 'instance')
      components.append(
        button('Reset overrides', () => command.resetInstance(), notify),
        button('Detach instance', () => command.detach(), notify),
      );
    else components.append(button('Create component', () => command.createComponent(), notify));
    const status = document.createElement('p');
    status.className = 'feature-note';
    status.textContent =
      n.component?.kind === 'instance'
        ? 'Linked instance — edits override the main component.'
        : n.component?.kind === 'main'
          ? 'Main component — edits update linked instances.'
          : 'Reusable frames with linked instances.';
    components.append(status);
    container.append(components);
  } else {
    const layout = section('Auto layout');
    layout.append(button('Wrap in auto layout', () => command.addLayout(), notify));
    container.append(layout);
  }
  if (n.type !== 'group') {
    const appearance = section('Fill, stroke & effects'),
      a = n.appearance ?? defaultAppearance();
    const paint = (action: (value: typeof a) => void) => {
      const next = clone(a);
      action(next);
      command.appearance(next);
    };
    checkbox(
      appearance,
      'Gradient fill',
      a.gradient.enabled,
      (v) => paint((a) => (a.gradient.enabled = v)),
      notify,
    );
    if (a.gradient.enabled) {
      inputField(
        appearance,
        'Gradient end',
        a.gradient.end,
        'color',
        (v) => paint((a) => (a.gradient.end = v)),
        notify,
      );
      inputField(
        appearance,
        'Gradient angle',
        a.gradient.angle,
        'number',
        (v) => paint((a) => (a.gradient.angle = Number(v))),
        notify,
      );
    }
    inputField(
      appearance,
      'Stroke',
      a.stroke,
      'color',
      (v) => paint((a) => (a.stroke = v)),
      notify,
    );
    inputField(
      appearance,
      'Stroke width',
      a.strokeWidth,
      'number',
      (v) => paint((a) => (a.strokeWidth = Number(v))),
      notify,
    );
    checkbox(
      appearance,
      'Drop shadow',
      a.shadow.enabled,
      (v) => paint((a) => (a.shadow.enabled = v)),
      notify,
    );
    if (a.shadow.enabled) {
      for (const key of ['x', 'y', 'blur', 'opacity'] as const)
        inputField(
          appearance,
          `Shadow ${key}`,
          a.shadow[key],
          'number',
          (v) => paint((a) => (a.shadow[key] = Number(v))),
          notify,
        );
      inputField(
        appearance,
        'Shadow color',
        a.shadow.color,
        'color',
        (v) => paint((a) => (a.shadow.color = v)),
        notify,
      );
    }
    inputField(
      appearance,
      'Layer blur',
      a.blur,
      'number',
      (v) => paint((a) => (a.blur = Number(v))),
      notify,
    );
    container.append(appearance);
  }
  if (n.image) {
    const image = section('Image fill');
    selectField(
      image,
      'Image fit',
      n.image.fit,
      [
        ['cover', 'Crop / cover'],
        ['contain', 'Fit'],
        ['stretch', 'Stretch'],
      ],
      (v) => command.image({ ...n.image!, fit: v as 'cover' | 'contain' | 'stretch' }),
      notify,
    );
    inputField(
      image,
      'Crop X (0–1)',
      n.image.focalX,
      'number',
      (v) => command.image({ ...n.image!, focalX: Number(v) }),
      notify,
    );
    inputField(
      image,
      'Crop Y (0–1)',
      n.image.focalY,
      'number',
      (v) => command.image({ ...n.image!, focalY: Number(v) }),
      notify,
    );
    image.append(
      button(
        'Remove image fill',
        () =>
          store.change(() => {
            delete n.image;
          }),
        notify,
      ),
    );
    container.append(image);
  }
  if (store.chosen().length === 1 && n.type === 'frame') {
    const grid = section('Layout grid'),
      g = n.layoutGrid ?? defaultGrid();
    const set = (action: (value: typeof g) => void) => {
      const next = clone(g);
      action(next);
      command.grid(next);
    };
    checkbox(
      grid,
      'Show layout grid',
      !!n.layoutGrid?.visible,
      (v) => set((g) => (g.visible = v)),
      notify,
    );
    if (n.layoutGrid) {
      selectField(
        grid,
        'Grid type',
        g.type,
        [
          ['grid', 'Square grid'],
          ['columns', 'Columns'],
          ['rows', 'Rows'],
        ],
        (v) => set((g) => (g.type = v as 'grid' | 'columns' | 'rows')),
        notify,
      );
      for (const key of ['count', 'size', 'gutter', 'margin'] as const)
        inputField(
          grid,
          `Grid ${key}`,
          g[key],
          'number',
          (v) => set((g) => (g[key] = Number(v))),
          notify,
        );
      grid.append(button('Remove grid', () => command.grid(undefined), notify));
    }
    container.append(grid);
  }
  if (store.chosen().length === 1 && n.vector) {
    const vector = section('Vector points');
    n.vector.rings.forEach((ring, r) =>
      ring.forEach((p, i) => {
        for (const axis of ['x', 'y'] as const)
          inputField(
            vector,
            `Path ${r + 1} point ${i + 1} ${axis}`,
            p[axis],
            'number',
            (v) => command.vertex(r, i, { ...p, [axis]: Number(v) }),
            notify,
          );
      }),
    );
    n.vector.rings.forEach((ring, r) =>
      ring.forEach((p, i) => {
        const label = 'Path ' + (r + 1) + ' point ' + (i + 1);
        vector.append(
          button(
            label + (p.in || p.out ? ': Corner' : ': Smooth'),
            () => command.pointKind(r, i, !p.in && !p.out),
            notify,
          ),
        );
        for (const side of ['in', 'out'] as const)
          if (p[side]) {
            for (const axis of ['x', 'y'] as const)
              inputField(
                vector,
                label + ' ' + side + ' ' + axis,
                p[side]![axis],
                'number',
                (v) => command.handle(r, i, side, { ...p[side]!, [axis]: Number(v) }),
                notify,
              );
          }
      }),
    );
    container.append(vector);
  }
  if (store.chosen().length >= 2) {
    const booleans = section('Boolean operations');
    for (const [operation, label] of [
      ['union', 'Union'],
      ['intersection', 'Intersect'],
      ['difference', 'Subtract'],
      ['xor', 'Exclude'],
    ] as const)
      booleans.append(button(label, () => command.boolean(operation), notify));
    container.append(booleans);
  }
  if (store.chosen().length === 1) {
    const prototype = section('Prototype'),
      p = n.prototype;
    const targets = allNodes(store.doc).filter((t) => t.type === 'frame' && !t.parentId);
    selectField(
      prototype,
      'On click →',
      p?.targetId ?? '',
      [['', 'No interaction'], ...targets.map((t) => [t.id, t.name] as const)],
      (v) => command.prototype(v, p?.transition ?? 'instant', p?.duration ?? 300),
      notify,
    );
    if (p) {
      selectField(
        prototype,
        'Transition',
        p.transition,
        [
          ['instant', 'Instant'],
          ['dissolve', 'Dissolve'],
        ],
        (v) => command.prototype(p.targetId, v as 'instant' | 'dissolve', p.duration),
        notify,
      );
      inputField(
        prototype,
        'Duration (ms)',
        p.duration,
        'number',
        (v) => command.prototype(p.targetId, p.transition, Number(v)),
        notify,
      );
    }
    container.append(prototype);
  }
  area.append(container);
}
