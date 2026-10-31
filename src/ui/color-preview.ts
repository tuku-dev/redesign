import type { EditorStore } from '../editor/store.ts';
import { clone } from '../model/types.ts';
import type { Notify } from './notifications.ts';
import { errorMessage } from './elements.ts';

export function bindColorPreview(
  input: HTMLInputElement,
  store: EditorStore,
  preview: (value: string) => void,
  notify: Notify,
): void {
  let before: typeof store.doc | undefined;
  const apply = () => {
    before ??= clone(store.doc);
    store.doc = clone(before);
    try {
      preview(input.value);
      store.refresh('scene');
    } catch (error) {
      store.doc = before;
      before = undefined;
      store.refresh();
      notify(errorMessage(error));
    }
  };
  input.addEventListener('input', apply);
  input.addEventListener('change', () => {
    if (!before) apply();
    if (!before) return;
    const snapshot = before;
    before = undefined;
    try {
      store.commit(snapshot);
    } catch (error) {
      store.doc = snapshot;
      store.refresh();
      notify(errorMessage(error));
    }
  });
}
