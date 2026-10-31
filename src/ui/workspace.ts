import type { EditorElements } from './elements.ts';
import type { EditorStore } from '../editor/store.ts';
import type { GestureController } from '../editor/gestures.ts';
import type { ViewportController } from '../editor/viewport.ts';
import type { Notify } from './notifications.ts';
import { GuideCommands } from '../commands/guides.ts';
import { FeatureCommands } from '../commands/features.ts';
import { bindRulers } from './rulers.ts';
import { bindImages } from './images.ts';
import { bindVectorEditor } from './vector-editor.ts';
import { presentPrototype } from './prototype.ts';
import { renderPages } from './pages.ts';
import { renderFeatureProperties } from './feature-properties.ts';
import { button, section, selectField, inputField } from './feature-controls.ts';
import { allNodes } from '../model/workspace.ts';
export function bindWorkspace(
  el: EditorElements,
  store: EditorStore,
  gestures: GestureController,
  viewport: ViewportController,
  notify: Notify,
): void {
  const pages = document.querySelector<HTMLElement>('#pages'),
    tools = document.querySelector<HTMLElement>('#workspace-tools');
  if (!pages || !tools) throw new Error('Missing workspace controls');
  const images = bindImages(el, store, viewport, notify),
    vector = bindVectorEditor(el, store, gestures, viewport, notify),
    guides = new GuideCommands(store);
  const penButton = document.querySelector<HTMLButtonElement>('#pen-tool');
  if (!penButton) throw new Error('Missing pen tool button');
  penButton.onclick = vector.start;
  bindRulers(el, store, notify);
  let shapeCount = 5;
  const render = () => {
    renderPages(pages, store, notify);
    tools.replaceChildren();
    const insert = section('Insert & preview');
    insert.append(
      button('Insert image', images.insert, notify),
      button('Set image fill', images.fill, notify),
      button('Draw vector path', vector.start, notify),
      button('Finish path', vector.finish, notify),
      button('Close path', vector.close, notify),
      button('Edit points', vector.edit, notify),
      button(
        'Present prototype',
        () => {
          gestures.cancel();
          presentPrototype(store, notify);
        },
        notify,
      ),
    );
    const components = allNodes(store.doc).filter((n) => n.component?.kind === 'main');
    if (components.length) {
      let source = components[0].id;
      selectField(
        insert,
        'Main component',
        source,
        components.map((n) => [n.id, n.name]),
        (v) => (source = v),
        notify,
      );
      insert.append(
        button('Insert instance', () => new FeatureCommands(store).instantiate(source), notify),
      );
    }
    tools.append(insert);
    const shapes = section('Shapes');
    const center = () => ({
      x: (el.canvas.clientWidth / 2 - store.pan.x) / store.zoom,
      y: (el.canvas.clientHeight / 2 - store.pan.y) / store.zoom,
    });
    inputField(
      shapes,
      'Polygon sides / star points',
      shapeCount,
      'number',
      (v) => (shapeCount = Math.min(60, Math.max(3, Math.round(Number(v)) || 5))),
      notify,
    );
    shapes.append(
      button('Insert line', () => new FeatureCommands(store).shape('line', center()), notify),
      button(
        'Insert polygon',
        () => new FeatureCommands(store).shape('polygon', center(), shapeCount),
        notify,
      ),
      button(
        'Insert star',
        () => new FeatureCommands(store).shape('star', center(), shapeCount),
        notify,
      ),
    );
    tools.append(shapes);
    const view = section('Rulers & guides');
    view.append(
      button(
        store.doc.workspace?.rulers ? 'Hide rulers' : 'Show rulers',
        () => guides.rulers(),
        notify,
      ),
      button(
        store.doc.workspace?.guidesVisible === false ? 'Show guides' : 'Hide guides',
        () => guides.toggle(),
        notify,
      ),
    );
    let axis: 'x' | 'y' = 'x',
      position = 0;
    selectField(
      view,
      'Guide axis',
      axis,
      [
        ['x', 'Vertical'],
        ['y', 'Horizontal'],
      ],
      (v) => (axis = v as 'x' | 'y'),
      notify,
    );
    inputField(view, 'Guide position', position, 'number', (v) => (position = Number(v)), notify);
    view.append(button('Add guide', () => guides.add(axis, position), notify));
    for (const guide of store.doc.workspace?.guides ?? []) {
      const row = document.createElement('div');
      row.className = 'guide-row';
      inputField(
        row,
        `${guide.axis === 'x' ? 'Vertical' : 'Horizontal'} guide`,
        guide.position,
        'number',
        (v) => guides.move(guide.id, Number(v)),
        notify,
      );
      row.append(button('Remove', () => guides.remove(guide.id), notify));
      view.append(row);
    }
    const note = document.createElement('p');
    note.className = 'feature-note';
    note.textContent =
      'Drag from a ruler to create a guide. Drag guides to move; double-click to remove.';
    view.append(note);
    tools.append(view);
    renderFeatureProperties(el.properties, store, notify);
  };
  document.addEventListener(
    'keydown',
    (e) => {
      if (
        e.defaultPrevented ||
        gestures.active ||
        (e.target instanceof Element &&
          e.target.closest('input,textarea,select,dialog,[contenteditable]'))
      )
        return;
      const mod = e.ctrlKey || e.metaKey,
        key = e.key.toLowerCase();
      let action: (() => void) | undefined;
      if (key === 'p' && !mod && !e.altKey) action = vector.start;
      if (key === 'a' && e.shiftKey && !mod && !e.altKey)
        action = () => new FeatureCommands(store).addLayout();
      if (key === 'r' && e.shiftKey && !mod && !e.altKey) action = () => guides.rulers();
      if (key === 'k' && mod && e.altKey)
        action = () => new FeatureCommands(store).createComponent();
      if (key === 'b' && mod && e.altKey) action = () => new FeatureCommands(store).detach();
      if (action) {
        e.preventDefault();
        e.stopImmediatePropagation();
        try {
          action();
        } catch (error) {
          notify(error instanceof Error ? error.message : 'Command failed.');
        }
      }
    },
    true,
  );
  store.subscribe((update) => {
    if (update.view === 'all') render();
  });
  render();
}
