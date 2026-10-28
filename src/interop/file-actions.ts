import type { EditorStore } from '../editor/store.ts';
import { validateDocument } from '../model/document.ts';
import type { EditorElements } from '../ui/elements.ts';
import { errorMessage } from '../ui/elements.ts';
import type { Notify } from '../ui/notifications.ts';
import { downloadFile } from './download.ts';
import { exportSvg } from './svg-export.ts';
export function bindFileActions(el: EditorElements, store: EditorStore, notify: Notify): void {
  el.save.onclick = () =>
    downloadFile(
      store.doc.name,
      JSON.stringify(store.doc, null, 2),
      'application/json',
      '.redesign',
    );
  el.open.onclick = () => el.file.click();
  el.file.onchange = () => {
    void openFile();
  };
  async function openFile(): Promise<void> {
    const file = el.file.files?.[0];
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('File exceeds the 20 MB limit.');
      const next = validateDocument(JSON.parse(await file.text()));
      store.change(() => {
        store.doc = next;
        store.selected.clear();
      });
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      el.file.value = '';
    }
  }
  el.exportSvg.onclick = () => {
    const data = exportSvg(store.doc);
    if (!data) return notify('Add a layer before exporting.');
    downloadFile(store.doc.name, data, 'image/svg+xml', '.svg');
    notify('SVG exported. This is not a native Figma document.');
  };
}
