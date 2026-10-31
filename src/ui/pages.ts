import type { EditorStore } from '../editor/store.ts';
import type { Notify } from './notifications.ts';
import { PageCommands } from '../commands/pages.ts';
import { button, inputField, selectField } from './feature-controls.ts';
export function renderPages(area: HTMLElement, store: EditorStore, notify: Notify): void {
  const commands = new PageCommands(store),
    w = store.doc.workspace;
  area.replaceChildren();
  selectField(
    area,
    'Page',
    w?.activePageId ?? 'page-1',
    (w?.pages ?? [{ id: 'page-1', name: 'Page 1' }]).map((p) => [p.id, p.name]),
    (id) => commands.switch(id),
    notify,
  );
  const active = w?.pages.find((p) => p.id === w.activePageId);
  inputField(
    area,
    'Page name',
    active?.name ?? 'Page 1',
    'text',
    (v) => commands.rename(v),
    notify,
  );
  const actions = document.createElement('div');
  actions.className = 'feature-actions';
  actions.append(
    button('Add page', () => commands.add(), notify),
    button('Duplicate page', () => commands.duplicate(), notify),
    button('Move page up', () => commands.reorder(-1), notify),
    button('Move page down', () => commands.reorder(1), notify),
  );
  const remove = button(
    'Delete page',
    () => {
      if (confirm('Delete this page and its layers? You can undo this.')) commands.remove();
    },
    notify,
  );
  remove.disabled = (w?.pages.length ?? 1) < 2;
  actions.append(remove);
  area.append(actions);
}
