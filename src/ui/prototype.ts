import type { EditorStore } from '../editor/store.ts';
import type { Notify } from './notifications.ts';
import { PrototypeSession } from '../model/prototype.ts';
import { renderDocument } from '../render/document.ts';
import { visualBox } from '../model/rotation.ts';
import { svg } from '../render/svg.ts';
import { button, run } from './feature-controls.ts';
export function presentPrototype(store: EditorStore, notify: Notify): void {
  const selected = store.current();
  let frame = selected;
  while (frame?.parentId) frame = store.doc.nodes.find((n) => n.id === frame!.parentId);
  if (frame?.type !== 'frame')
    frame = store.doc.nodes.find((n) => n.type === 'frame' && !n.parentId && !n.hidden);
  if (!frame) throw new Error('Create a frame before presenting a prototype.');
  const session = new PrototypeSession(store.doc, frame.id),
    dialog = document.createElement('dialog'),
    toolbar = document.createElement('div'),
    stage = document.createElement('div'),
    title = document.createElement('strong');
  dialog.className = 'prototype-dialog';
  dialog.setAttribute('aria-label', 'Prototype preview');
  toolbar.className = 'prototype-toolbar';
  stage.className = 'prototype-stage';
  const back = button(
      'Back',
      () => {
        session.back();
        render();
      },
      notify,
    ),
    restart = button(
      'Restart',
      () => {
        session.restart();
        render();
      },
      notify,
    ),
    close = button('Close preview', () => dialog.close(), notify);
  toolbar.append(back, restart, title, close);
  dialog.append(toolbar, stage);
  document.body.append(dialog);
  function render(transition?: 'instant' | 'dissolve', duration = 0): void {
    const frame = session.frame(),
      box = visualBox(frame),
      canvas = svg('svg', {
        viewBox: `${box.x} ${box.y} ${box.width} ${box.height}`,
        width: box.width,
        height: box.height,
        role: 'group',
        'aria-label': frame.name,
      });
    const scene = session.scene();
    canvas.append(
      ...renderDocument(
        { ...scene, nodes: scene.nodes.map((n) => ({ ...n, locked: false })) },
        { interactive: true },
      ),
    );
    const hotspots = new Set(scene.nodes.filter((n) => n.prototype).map((n) => n.id));
    canvas.querySelectorAll<SVGElement>('[data-id]').forEach((el) => {
      const id = el.getAttribute('data-id');
      if (!id || !hotspots.has(id)) return;
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', scene.nodes.find((n) => n.id === id)?.name ?? 'Navigate');
      el.style.cursor = 'pointer';
    });
    const activate = (target: EventTarget | null) =>
      run(notify, () => {
        const id = (target as Element | null)?.closest('[data-id]')?.getAttribute('data-id');
        if (!id) return;
        const action = session.activate(id);
        if (action) render(action.transition, action.duration);
      });
    canvas.addEventListener('click', (e) => activate(e.target));
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(e.target);
      }
    });
    stage.replaceChildren(canvas);
    title.textContent = frame.name;
    back.disabled = !session.canGoBack;
    if (transition === 'dissolve' && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      stage.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration });
    canvas.querySelector<SVGElement>('[tabindex]')?.focus();
  }
  const focus = document.activeElement as HTMLElement | null;
  dialog.addEventListener(
    'close',
    () => {
      dialog.remove();
      focus?.focus();
    },
    { once: true },
  );
  // Keep editor keyboard shortcuts out of the preview, including native dialog Escape.
  dialog.addEventListener('keydown', (e) => e.stopPropagation());
  render();
  dialog.showModal();
  close.focus();
}
