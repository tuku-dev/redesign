import type { EditorStore } from '../editor/store.ts';
import { toggleId } from '../model/selection.ts';
import { hierarchyRows, selectionRoots } from '../model/hierarchy.ts';
import { isHidden, isLocked } from '../model/layer-state.ts';
import { LayerStateCommands } from '../commands/layer-state.ts';
import { LayerOrderCommands } from '../commands/layer-order.ts';
import { createIcon } from './icons.ts';
export function renderLayers(area: HTMLElement, store: EditorStore): void {
  area.replaceChildren();
  const states = new LayerStateCommands(store),
    order = new LayerOrderCommands(store);
  let draggedIds: Set<string> | undefined;
  const clearDropTargets = () =>
    area.querySelectorAll('.layer').forEach((item) => {
      item.classList.remove('drop-before', 'drop-after');
    });
  for (const { node: n, depth } of hierarchyRows({
    ...store.doc,
    nodes: [...store.doc.nodes].reverse(),
  })) {
    const row = document.createElement('div');
    row.className = 'layer' + (store.selected.has(n.id) ? ' active' : '');
    row.dataset.layerId = n.id;
    row.dataset.parentId = n.parentId ?? '';
    row.style.paddingLeft = `${8 + depth * 16}px`;
    row.classList.toggle('layer-hidden', isHidden(store.doc, n));
    row.draggable = !isLocked(store.doc, n);
    row.ondragstart = (event) => {
      if (!event.dataTransfer || isLocked(store.doc, n)) {
        event.preventDefault();
        return;
      }
      const roots = selectionRoots(
        store.doc,
        store.selected.has(n.id) ? store.selected : new Set([n.id]),
      );
      draggedIds = new Set(roots.map((root) => root.id));
      if (!draggedIds.size || roots.some((root) => isLocked(store.doc, root))) {
        event.preventDefault();
        draggedIds = undefined;
        return;
      }
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', [...draggedIds].join(','));
      row.classList.add('dragging');
    };
    row.ondragover = (event) => {
      if (!draggedIds || !order.canReorderRelative(draggedIds, n.id)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      clearDropTargets();
      const rect = row.getBoundingClientRect();
      row.classList.add(event.clientY < rect.top + rect.height / 2 ? 'drop-before' : 'drop-after');
    };
    row.ondrop = (event) => {
      if (!draggedIds || !order.canReorderRelative(draggedIds, n.id)) return;
      event.preventDefault();
      const rect = row.getBoundingClientRect(),
        after = event.clientY >= rect.top + rect.height / 2,
        ids = draggedIds;
      draggedIds = undefined;
      store.selected = new Set(ids);
      order.reorderRelative(ids, n.id, after);
      clearDropTargets();
    };
    row.ondragend = () => {
      draggedIds = undefined;
      row.classList.remove('dragging');
      clearDropTargets();
    };
    const select = document.createElement('button');
    select.className = 'layer-select';
    select.setAttribute('aria-pressed', String(store.selected.has(n.id)));
    const symbol = document.createElement('span');
    symbol.className = 'symbol';
    symbol.append(createIcon(n.type));
    const label = document.createElement('span');
    label.className = 'layer-name';
    label.textContent = n.name;
    select.append(symbol, label);
    select.onclick = (e) => {
      store.selected = e.shiftKey ? toggleId(store.selected, n.id) : new Set([n.id]);
      store.refresh();
    };
    row.append(select);
    for (const key of ['locked', 'hidden'] as const) {
      const b = document.createElement('button');
      b.className = 'layer-state-button';
      const active = key === 'locked' ? isLocked(store.doc, n) : isHidden(store.doc, n);
      b.classList.toggle('is-active', active);
      b.append(
        createIcon(key === 'locked' ? (active ? 'lock' : 'unlock') : active ? 'eyeOff' : 'eye'),
      );
      b.title =
        (key === 'locked' ? (n.locked ? 'Unlock ' : 'Lock ') : n.hidden ? 'Show ' : 'Hide ') +
        n.name;
      b.setAttribute('aria-label', b.title);
      b.setAttribute('aria-pressed', String(n[key]));
      b.onclick = () => states.setFor(n.id, key);
      row.append(b);
    }
    area.append(row);
  }
}
