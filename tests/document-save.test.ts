import test from 'node:test';
import assert from 'node:assert/strict';
import { DocumentFileSaver } from '../src/interop/document-save.ts';
import type { DocumentFileHandle, DocumentSaveEnvironment } from '../src/interop/document-save.ts';
import { documentNameFromFile, safeDocumentName } from '../src/interop/document-name.ts';
import { EditorStore } from '../src/editor/store.ts';
function environment(overrides: Partial<DocumentSaveEnvironment> = {}): DocumentSaveEnvironment {
  return { requestName: () => 'Dashboard', download: () => {}, persist: () => {}, ...overrides };
}
test('file titles remove one supported extension and normalize download filenames', () => {
  assert.equal(documentNameFromFile('Checkout.final.redesign'), 'Checkout.final');
  assert.equal(documentNameFromFile('Imported.JSON'), 'Imported');
  assert.equal(safeDocumentName('  My:design.redesign  '), 'My_design');
  assert.equal(safeDocumentName(''), 'Untitled');
  assert.equal(safeDocumentName('Screen.redesign'), 'Screen');
});
test('fallback save keeps header metadata and downloaded filename in sync', async () => {
  const store = new EditorStore();
  let filename = '',
    data = '',
    extension = '';
  const saver = new DocumentFileSaver(
    store,
    environment({
      requestName: () => 'My:design.redesign',
      download: (name, payload, _type, ext) => {
        filename = name;
        data = payload;
        extension = ext;
      },
    }),
  );
  const result = await saver.save(true);
  assert.equal(filename, 'My_design');
  assert.equal(extension, '.redesign');
  assert.equal(store.doc.name, 'My_design');
  assert.equal(JSON.parse(data).name, store.doc.name);
  assert.equal(result?.mode, 'download');
});
test('canceling fallback save does not rename or add history', async () => {
  const store = new EditorStore(),
    before = structuredClone(store.doc),
    saver = new DocumentFileSaver(
      store,
      environment({
        requestName: () => null,
        download: () => {
          throw new Error('Unexpected download');
        },
      }),
    );
  assert.equal(await saver.save(true), null);
  assert.deepEqual(store.doc, before);
  assert.equal(store.history.past.length, 0);
});
test('a download failure leaves the document name unchanged', async () => {
  const store = new EditorStore(),
    saver = new DocumentFileSaver(
      store,
      environment({
        download: () => {
          throw new Error('Download failed');
        },
      }),
    );
  await assert.rejects(() => saver.save(true), /Download failed/);
  assert.equal(store.doc.name, 'Untitled');
});
test('native save uses the chosen filename in its payload and commits the title only after close', async () => {
  const store = new EditorStore();
  let releaseClose!: () => void,
    markWritten!: () => void,
    data = '';
  const closing = new Promise<void>((resolve) => (releaseClose = resolve)),
    written = new Promise<void>((resolve) => (markWritten = resolve));
  const saver = new DocumentFileSaver(
    store,
    environment({
      pick: async (options) => {
        assert.equal(options.suggestedName, 'Untitled.redesign');
        return {
          name: 'Chosen file.redesign',
          createWritable: async () => ({
            write: async (payload) => {
              data = payload;
              markWritten();
            },
            close: () => closing,
          }),
        };
      },
    }),
  );
  const pending = saver.save();
  await written;
  assert.equal(store.doc.name, 'Untitled');
  assert.equal(JSON.parse(data).name, 'Chosen file');
  releaseClose();
  assert.equal((await pending)?.mode, 'file');
  assert.equal(store.doc.name, 'Chosen file');
});
test('canceling native save preserves name and contents', async () => {
  const store = new EditorStore(),
    before = structuredClone(store.doc),
    saver = new DocumentFileSaver(
      store,
      environment({
        pick: async () => {
          throw new DOMException('Canceled', 'AbortError');
        },
      }),
    );
  assert.equal(await saver.save(), null);
  assert.deepEqual(store.doc, before);
  assert.equal(store.history.past.length, 0);
});
test('write and close failures abort the stream and do not rename the document', async () => {
  for (const phase of ['write', 'close']) {
    const store = new EditorStore();
    let aborted = false;
    const saver = new DocumentFileSaver(
      store,
      environment({
        pick: async () => ({
          name: 'Failed.redesign',
          createWritable: async () => ({
            write: async () => {
              if (phase === 'write') throw new Error('Disk full');
            },
            close: async () => {
              if (phase === 'close') throw new Error('Disk full');
            },
            abort: async () => {
              aborted = true;
            },
          }),
        }),
      }),
    );
    await assert.rejects(() => saver.save(), /Disk full/);
    assert.equal(store.doc.name, 'Untitled');
    assert.equal(aborted, true);
  }
});
test('Save reuses the file handle despite title edits; only Save As or reset chooses again', async () => {
  const store = new EditorStore();
  let count = 0;
  const saver = new DocumentFileSaver(
    store,
    environment({
      pick: async () => {
        count++;
        return {
          name: store.doc.name === 'Untitled' ? 'First.redesign' : store.doc.name + '.redesign',
          createWritable: async () => ({ write: async () => {}, close: async () => {} }),
        };
      },
    }),
  );
  await saver.save();
  await saver.save();
  assert.equal(count, 1);
  store.doc.name = 'Second';
  await saver.save();
  assert.equal(count, 1);
  await saver.save(true);
  assert.equal(count, 2);
  saver.reset();
  await saver.save();
  assert.equal(count, 3);
});
test('opening another document while a picker is pending cancels the old save', async () => {
  const store = new EditorStore();
  let choose!: (handle: DocumentFileHandle) => void,
    wrote = false;
  const pendingPicker = new Promise<DocumentFileHandle>((resolve) => (choose = resolve));
  const saver = new DocumentFileSaver(store, environment({ pick: () => pendingPicker }));
  const saving = saver.save();
  saver.reset();
  store.doc.name = 'New document';
  choose({
    name: 'Old document.redesign',
    createWritable: async () => {
      wrote = true;
      return { write: async () => {}, close: async () => {} };
    },
  });
  assert.equal(await saving, null);
  assert.equal(wrote, false);
  assert.equal(store.doc.name, 'New document');
});
test('duplicate save requests do not open multiple pickers', async () => {
  const store = new EditorStore();
  let choose!: (handle: DocumentFileHandle) => void,
    count = 0;
  const picker = new Promise<DocumentFileHandle>((resolve) => (choose = resolve));
  const saver = new DocumentFileSaver(
    store,
    environment({
      pick: () => {
        count++;
        return picker;
      },
    }),
  );
  const first = saver.save();
  assert.equal(await saver.save(), null);
  assert.equal(count, 1);
  choose({
    name: 'One.redesign',
    createWritable: async () => ({ write: async () => {}, close: async () => {} }),
  });
  await first;
});
test('ordinary fallback Save persists changes repeatedly without asking for a name or downloading', async () => {
  const store = new EditorStore();
  let saved = 0;
  const saver = new DocumentFileSaver(
    store,
    environment({
      persist: (doc) => {
        saved++;
        assert.equal(doc.name, store.doc.name);
      },
      requestName: () => {
        throw new Error('Unexpected filename request');
      },
      download: () => {
        throw new Error('Unexpected download');
      },
    }),
  );
  assert.equal((await saver.save())?.mode, 'browser');
  store.doc.name = 'Edited';
  assert.equal((await saver.save())?.mode, 'browser');
  assert.equal(saved, 2);
  assert.equal(store.doc.name, 'Edited');
});
test('browser storage errors are reported without claiming a file was saved', async () => {
  const saver = new DocumentFileSaver(
    new EditorStore(),
    environment({
      persist: () => {
        throw new Error('Storage full');
      },
    }),
  );
  await assert.rejects(() => saver.save(), /Storage full/);
});
test('an opened file handle is reused directly without opening Save As', async () => {
  const store = new EditorStore();
  let writes = 0;
  const saver = new DocumentFileSaver(
    store,
    environment({
      pick: async () => {
        throw new Error('Unexpected Save As');
      },
    }),
  );
  saver.reset({
    name: 'Opened.redesign',
    createWritable: async () => ({
      write: async () => {
        writes++;
      },
      close: async () => {},
    }),
  });
  await saver.save();
  await saver.save();
  assert.equal(writes, 2);
  assert.equal(store.doc.name, 'Opened');
});
