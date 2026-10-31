import { DocumentFileSaver } from './document-save.ts';
import type { DocumentFileHandle, SavePickerOptions } from './document-save.ts';
import { documentNameFromFile } from './document-name.ts';
import type { EditorStore } from '../editor/store.ts';
import { validateDocument } from '../model/document.ts';
import type { EditorElements } from '../ui/elements.ts';
import { errorMessage } from '../ui/elements.ts';
import type { Notify } from '../ui/notifications.ts';
import { requestDownloadName } from '../ui/save-dialog.ts';
import { downloadFile } from './download.ts';
import { exportSvg } from './svg-export.ts';
import { rejectBinaryDocument } from './fig-container.ts';
import { importSvg, looksLikeSvg } from './svg-import.ts';
import { bindDocuments } from '../ui/documents.ts';
interface OpenDocumentHandle extends DocumentFileHandle {
  getFile(): Promise<File>;
}
export function bindFileActions(
  el: EditorElements,
  store: EditorStore,
  notify: Notify,
  prepareSave: () => void = () => {},
): void {
  const pickerWindow = window as Window & {
    showSaveFilePicker?: (options: SavePickerOptions) => Promise<DocumentFileHandle>;
    showOpenFilePicker?: (options: {
      multiple: boolean;
      types: SavePickerOptions['types'];
    }) => Promise<OpenDocumentHandle[]>;
  };
  const direct = window.isSecureContext && typeof pickerWindow.showSaveFilePicker === 'function';
  const saver = new DocumentFileSaver(store, {
    ...(direct
      ? {
          pick: (options: SavePickerOptions) =>
            pickerWindow.showSaveFilePicker!.call(window, options),
        }
      : {}),
    requestName: requestDownloadName,
    download: downloadFile,
    persist: (doc) => localStorage.setItem('redesign.document', JSON.stringify(doc)),
  });
  el.save.title = direct ? 'Save (Ctrl+S)' : 'Save in this browser (Ctrl+S)';
  el.saveAs.textContent = direct ? 'Save as' : 'Download copy';
  el.saveAs.title = direct ? 'Save as (Ctrl+Shift+S)' : 'Download a .redesign copy (Ctrl+Shift+S)';
  const save = (asNew: boolean) => {
    if (el.save.disabled) return;
    try {
      // Commit focused fields and inline text before serializing the document.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      prepareSave();
      document.dispatchEvent(new Event('redesign:before-save'));
    } catch (error) {
      notify(errorMessage(error));
      return;
    }
    el.save.disabled = true;
    el.saveAs.disabled = true;
    void saver
      .save(asNew)
      .then((result) => {
        if (!result) return;
        if (result.mode === 'browser') {
          el.saveStatus.textContent = 'Saved in this browser';
          notify('Saved in this browser. Use Download copy for a file.');
        } else if (result.mode === 'file') {
          el.saveStatus.textContent = 'Saved to file';
          notify('Saved ' + result.name + '.redesign.');
        } else
          notify(
            'Downloaded copy: ' +
              result.name +
              '.redesign. Save keeps future changes in this browser.',
          );
      })
      .catch((error) => {
        el.saveStatus.textContent = 'Save failed';
        notify(errorMessage(error));
      })
      .finally(() => {
        el.save.disabled = false;
        el.saveAs.disabled = false;
      });
  };
  el.save.onclick = () => save(false);
  el.saveAs.onclick = () => save(true);
  const documents = bindDocuments(el.documents, store, saver, notify, prepareSave);
  el.newDocument.onclick = () => {
    try {
      prepareSave();
      documents.newDocument();
      el.saveStatus.textContent = 'New document';
    } catch (error) {
      notify(errorMessage(error));
    }
  };
  // Capture before editor tools and focused fields can consume the shortcut or open Save Page.
  document.addEventListener(
    'keydown',
    (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if ((e.target as Element)?.closest?.('dialog')) return;
      save(e.shiftKey);
    },
    true,
  );
  store.subscribe((update) => {
    if (update.persist && saver.hasFile) el.saveStatus.textContent = 'Unsaved file changes';
  });
  async function openFile(file: File, handle: DocumentFileHandle | null = null): Promise<void> {
    if (file.size > 100 * 1024 * 1024) throw new Error('File exceeds the 100 MB limit.');
    await rejectBinaryDocument(file);
    const text = await file.text();
    // An SVG is imported as a new document; it never keeps a handle, so Save cannot overwrite the .svg.
    const svgImport = looksLikeSvg(file, text);
    const next = svgImport
      ? importSvg(text, documentNameFromFile(file.name))
      : validateDocument(JSON.parse(text));
    prepareSave();
    next.name = documentNameFromFile(file.name);
    documents.open(next, svgImport ? null : handle);
    el.saveStatus.textContent = svgImport
      ? 'Imported SVG'
      : handle
        ? 'Opened local file'
        : 'Saved in this browser';
  }
  el.open.onclick = () => {
    if (window.isSecureContext && pickerWindow.showOpenFilePicker) {
      void pickerWindow
        .showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: 'reDesign document',
              accept: {
                'application/json': ['.redesign', '.json'],
                'image/svg+xml': ['.svg'],
              },
            },
          ],
        })
        .then(async (handles) => {
          const handle = handles[0];
          if (handle) await openFile(await handle.getFile(), handle);
        })
        .catch((error) => {
          if (!(error instanceof Error && error.name === 'AbortError')) notify(errorMessage(error));
        });
    } else el.file.click();
  };
  el.file.onchange = () => {
    const file = el.file.files?.[0];
    if (!file) return;
    void openFile(file)
      .catch((error) => notify(errorMessage(error)))
      .finally(() => {
        el.file.value = '';
      });
  };
  el.exportSvg.onclick = () => {
    const data = exportSvg(store.doc);
    if (!data) return notify('Add a layer before exporting.');
    downloadFile(store.doc.name, data, 'image/svg+xml', '.svg');
    notify('SVG exported. This is not a native Figma document.');
  };
}
