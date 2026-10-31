import type { EditorStore } from '../editor/store.ts';
import type { TextEditSession } from '../editor/text-edit.ts';
import type { EditorElements } from './elements.ts';
import { errorMessage } from './elements.ts';
import type { Notify } from './notifications.ts';
export function bindInlineText(
  el: EditorElements,
  store: EditorStore,
  session: TextEditSession,
  notify: Notify,
): { begin: (id: string) => void; sync: () => void } {
  let input: HTMLTextAreaElement | null = null;
  const commit = () => {
    try {
      session.commit();
    } catch (error) {
      notify(errorMessage(error));
    }
  };
  const sync = () => {
    const n = store.doc.nodes.find((n) => n.id === session.id);
    if (!n) {
      input?.remove();
      input = null;
      return;
    }
    if (!input) {
      input = document.createElement('textarea');
      input.className = 'inline-text-editor';
      input.setAttribute('aria-label', 'Edit text on canvas');
      input.spellcheck = false;
      input.value = n.text;
      input.oninput = () => {
        if (input) session.update(input.value);
      };
      input.onblur = commit;
      input.onkeydown = (e) => {
        if (e.isComposing) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          session.cancel();
          el.canvas.focus();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          commit();
          el.canvas.focus();
        }
      };
      el.workspace.append(input);
      input.focus();
      input.select();
    }
    const z = store.zoom;
    Object.assign(input.style, {
      left: `${store.pan.x + n.x * z}px`,
      top: `${store.pan.y + n.y * z}px`,
      width: `${n.width * z}px`,
      height: `${Math.max(n.height, n.fontSize * n.lineHeight) * z}px`,
      fontFamily: n.fontFamily,
      fontSize: `${n.fontSize * z}px`,
      fontWeight: String(n.fontWeight),
      fontStyle: n.fontStyle,
      lineHeight: String(n.lineHeight),
      letterSpacing: `${n.letterSpacing * z}px`,
      textAlign: n.textAlign,
      color: n.fill,
      opacity: String(n.opacity),
      transform: `rotate(${n.rotation}deg) scale(${n.flipX ? -1 : 1}, ${n.flipY ? -1 : 1})`,
      transformOrigin: `${(n.width * z) / 2}px ${(n.height * z) / 2}px`,
    });
    input.wrap = n.textWrap === 'word' ? 'soft' : 'off';
  };
  const begin = (id: string) => {
    try {
      session.start(id);
    } catch (error) {
      notify(errorMessage(error));
    }
  };
  el.canvas.addEventListener('dblclick', (e) => {
    const target = e.target instanceof Element ? e.target : null,
      id = target?.closest('[data-id]')?.getAttribute('data-id');
    if (id) begin(id);
  });
  document.fonts?.addEventListener('loadingdone', () => store.refresh('scene'));
  return { begin, sync };
}
