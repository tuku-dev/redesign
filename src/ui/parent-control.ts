import { descendants, selectionRoots } from '../model/hierarchy.ts';
import type { EditorStore } from '../editor/store.ts';
import type { EditingCommands } from '../commands/editing.ts';
import type { Notify } from './notifications.ts';
import { errorMessage } from './elements.ts';
export function renderParentControl(
  group: HTMLElement,
  store: EditorStore,
  commands: EditingCommands,
  notify: Notify,
): void {
  const roots = selectionRoots(store.doc, store.selected);
  if (!roots.length) return;
  const excluded = new Set(descendants(store.doc, store.selected).map((n) => n.id)),
    label = document.createElement('label');
  label.className = 'parent-control';
  const caption = document.createElement('span');
  caption.textContent = 'Parent';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Parent frame');
  const mixed = roots.some((n) => n.parentId !== roots[0].parentId);
  if (mixed) {
    const option = new Option('Mixed parents', 'mixed');
    option.disabled = true;
    select.append(option);
  }
  select.append(new Option('Page 1 (no frame)', ''));
  for (const n of store.doc.nodes)
    if ((n.type === 'frame' || n.type === 'group') && !excluded.has(n.id))
      select.append(new Option(n.name, n.id));
  select.value = mixed ? 'mixed' : (roots[0].parentId ?? '');
  select.onchange = () => {
    try {
      commands.setParent(select.value || null);
    } catch (error) {
      notify(errorMessage(error));
      store.refresh();
    }
  };
  label.append(caption, select);
  group.append(label);
}
