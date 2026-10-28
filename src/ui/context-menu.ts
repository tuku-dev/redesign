import { buildContextMenu } from './context-menu-actions.ts';
import type { MenuServices, MenuSection } from './context-menu-actions.ts';
import type { EditorElements } from './elements.ts';
import { errorMessage } from './elements.ts';
import type { GestureController } from '../editor/gestures.ts';
import type { ViewportController } from '../editor/viewport.ts';
import type { Notify } from './notifications.ts';
interface Panel {
  element: HTMLDivElement;
  anchor?: HTMLButtonElement;
}
export function bindContextMenu(
  el: EditorElements,
  services: MenuServices,
  gestures: GestureController,
  viewport: ViewportController,
  notify: Notify,
): void {
  const panels: Panel[] = [];
  const close = (focus = true) => {
    panels.splice(0).forEach((p) => p.element.remove());
    if (focus) el.canvas.focus();
  };
  const trim = (depth: number) => panels.splice(depth).forEach((p) => p.element.remove());
  const buttons = (panel: HTMLElement) =>
    [...panel.querySelectorAll<HTMLButtonElement>(':scope > button')].filter((b) => !b.disabled);
  function panel(
    sections: MenuSection[],
    x: number,
    y: number,
    depth: number,
    anchor?: HTMLButtonElement,
  ): HTMLDivElement {
    trim(depth);
    const element = document.createElement('div');
    element.className = 'context-menu';
    element.setAttribute('role', 'menu');
    element.setAttribute('aria-label', depth ? 'Editor submenu' : 'Editor actions');
    element.style.visibility = 'hidden';
    for (const [i, section] of sections.entries()) {
      if (i) {
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        separator.setAttribute('role', 'separator');
        element.append(separator);
      }
      for (const entry of section) {
        const b = document.createElement('button');
        b.className = 'context-menu-item';
        b.dataset.action = entry.id;
        b.setAttribute('role', 'menuitem');
        b.disabled = entry.disabled ?? false;
        if (entry.danger) b.classList.add('danger');
        const label = document.createElement('span');
        label.className = 'context-menu-label';
        label.textContent = entry.label;
        b.append(label);
        if (entry.shortcut) {
          const shortcut = document.createElement('span');
          shortcut.className = 'context-menu-shortcut';
          shortcut.textContent = entry.shortcut;
          b.append(shortcut);
        }
        if (entry.children) {
          const arrow = document.createElement('span');
          arrow.textContent = '›';
          arrow.className = 'context-menu-arrow';
          b.append(arrow);
          b.setAttribute('aria-haspopup', 'menu');
          b.setAttribute('aria-expanded', 'false');
        }
        const openChild = () => {
          if (!entry.children || b.disabled) return;
          const rect = b.getBoundingClientRect();
          const submenu = panel(entry.children, rect.right + 4, rect.top, depth + 1, b);
          b.setAttribute('aria-expanded', 'true');
          return submenu;
        };
        b.onmouseenter = () => {
          for (const sibling of element.querySelectorAll('[aria-expanded]'))
            sibling.setAttribute('aria-expanded', 'false');
          if (entry.children) openChild();
          else trim(depth + 1);
        };
        b.onfocus = () => {
          if (!entry.children) trim(depth + 1);
        };
        b.onclick = () => {
          if (entry.children) {
            const child = openChild();
            if (child) buttons(child)[0]?.focus();
            return;
          }
          close();
          try {
            const result = entry.run?.();
            if (result instanceof Promise)
              void result.catch((error) => notify(errorMessage(error)));
          } catch (error) {
            notify(errorMessage(error));
          }
        };
        b.onkeydown = (e) => {
          if (e.key === 'ArrowRight' && entry.children) {
            e.preventDefault();
            const child = openChild();
            if (child) buttons(child)[0]?.focus();
          }
        };
        element.append(b);
      }
    }
    document.body.append(element);
    panels.push({ element, anchor });
    const rect = element.getBoundingClientRect();
    if (depth && anchor && x + rect.width > window.innerWidth - 8)
      x = anchor.getBoundingClientRect().left - rect.width - 4;
    element.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
    element.style.visibility = 'visible';
    element.addEventListener('scroll', () => trim(depth + 1));
    return element;
  }
  const open = (event: MouseEvent) => {
    event.preventDefault();
    gestures.cancel();
    close(false);
    const target = event.target instanceof Element ? event.target : null;
    const keyboard = event.clientX === 0 && event.clientY === 0;
    const layerId = target?.closest('[data-layer-id]')?.getAttribute('data-layer-id');
    const id =
      layerId ??
      target?.closest('[data-id]')?.getAttribute('data-id') ??
      (keyboard ? (services.store.current()?.id ?? null) : null);
    services.selection.context(id, Boolean(layerId), event.ctrlKey || event.metaKey);
    const rect = el.canvas.getBoundingClientRect(),
      point = viewport.point(
        {
          x: keyboard ? rect.left + rect.width / 2 : event.clientX,
          y: keyboard ? rect.top + rect.height / 2 : event.clientY,
        },
        { x: rect.left, y: rect.top },
      );
    const root = panel(
      buildContextMenu(services, point),
      keyboard ? rect.left + rect.width / 2 : event.clientX,
      keyboard ? rect.top + rect.height / 2 : event.clientY,
      0,
    );
    buttons(root)[0]?.focus();
  };
  el.canvas.addEventListener('contextmenu', open);
  el.layers.addEventListener('contextmenu', open);
  // Capture dismiss/navigation keys before the editor's global shortcuts.
  document.addEventListener(
    'keydown',
    (e) => {
      if (!panels.length) return;
      const active = document.activeElement;
      const current =
        panels.find((p) => active instanceof Element && p.element.contains(active)) ??
        panels.at(-1)!;
      const items = buttons(current.element),
        index = items.indexOf(active as HTMLButtonElement);
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (active instanceof HTMLButtonElement && active.getAttribute('aria-haspopup') === 'menu')
          active.click();
        return;
      }
      if (e.key === 'Tab') {
        close(false);
        return;
      }
      e.stopImmediatePropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const depth = panels.indexOf(current);
        if (depth) {
          const anchor = current.anchor;
          trim(depth);
          anchor?.setAttribute('aria-expanded', 'false');
          anchor?.focus();
        }
        return;
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const next =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? items.length - 1
              : e.key === 'ArrowDown'
                ? (index + 1) % items.length
                : (index - 1 + items.length) % items.length;
        items[next]?.focus();
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (active instanceof HTMLButtonElement) active.click();
      }
    },
    true,
  );
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (
        panels.length &&
        e.target instanceof Node &&
        !panels.some((p) => p.element.contains(e.target as Node))
      )
        close(false);
    },
    true,
  );
  window.addEventListener('blur', () => close(false));
  window.addEventListener('resize', () => close(false));
}
