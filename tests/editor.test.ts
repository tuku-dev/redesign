import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorStore } from '../src/editor/store.ts';
import { GestureController } from '../src/editor/gestures.ts';
import { EditingCommands } from '../src/commands/editing.ts';
import { ViewportController } from '../src/editor/viewport.ts';
import { createDocument, createNode, validateDocument } from '../src/model/document.ts';
import { clone } from '../src/model/types.ts';
import { ClipboardController } from '../src/interop/clipboard-controller.ts';
import { browserDocumentStorage } from '../src/storage/local-document.ts';

function editor() {
  const doc = createDocument();
  doc.nodes = [
    createNode('rectangle', { x: 10, y: 20, width: 80, height: 60 }),
    createNode('ellipse', { x: 150, y: 50, width: 40, height: 40 }),
  ];
  const store = new EditorStore(doc);
  store.selected = new Set(doc.nodes.map((n) => n.id));
  return { store, commands: new EditingCommands(store), gestures: new GestureController(store) };
}
const modifiers = { aspect: false, center: false };
test('a complete pointer move is one undoable persisted transaction', () => {
  const { store, gestures } = editor(),
    before = clone(store.doc);
  let saves = 0;
  store.subscribe((update) => {
    if (update.persist) saves++;
  });
  gestures.startSelection({ x: 0, y: 0 }, store.doc.nodes[0].id, false);
  gestures.move({ x: 5, y: 10 }, { x: 5, y: 10 }, modifiers);
  gestures.move({ x: 20, y: 30 }, { x: 20, y: 30 }, modifiers);
  assert.equal(store.history.past.length, 0);
  assert.equal(saves, 0);
  gestures.finish();
  assert.equal(store.history.past.length, 1);
  assert.equal(saves, 1);
  assert.equal(store.doc.nodes[0].x, 30);
  assert.equal(store.doc.nodes[1].x, 170);
  store.undo();
  assert.deepEqual(store.doc, before);
  store.redo();
  assert.equal(store.doc.nodes[0].x, 30);
});
test('canceling move, resize and drawing restores the document and selection without saving', () => {
  for (const kind of ['move', 'resize', 'draw']) {
    const { store, gestures } = editor(),
      before = clone(store.doc),
      selection = new Set(store.selected);
    let saves = 0;
    store.subscribe((update) => {
      if (update.persist) saves++;
    });
    if (kind === 'move') gestures.startSelection({ x: 0, y: 0 }, store.doc.nodes[0].id, false);
    if (kind === 'resize') gestures.startResize({ x: 0, y: 0 }, 'se');
    if (kind === 'draw') {
      store.tool = 'rectangle';
      gestures.startDrawing({ x: 0, y: 0 });
    }
    gestures.move({ x: 40, y: 50 }, { x: 40, y: 50 }, modifiers);
    assert.notDeepEqual(store.doc, before);
    assert.equal(gestures.cancel(), true);
    assert.deepEqual(store.doc, before);
    assert.deepEqual(store.selected, selection);
    assert.equal(store.history.past.length, 0);
    assert.equal(saves, 0);
    assert.equal(gestures.cancel(), false);
  }
});
test('selection and no-op pointer clicks leave redo history intact', () => {
  const { store, commands, gestures } = editor();
  commands.nudge(1, 0);
  store.undo();
  const future = clone(store.history.future);
  gestures.startSelection({ x: 0, y: 0 }, store.doc.nodes[0].id, false);
  gestures.finish();
  assert.equal(store.history.past.length, 0);
  assert.deepEqual(store.history.future, future);
  gestures.startSelection({ x: 0, y: 0 }, null, false);
  gestures.move({ x: 200, y: 200 }, { x: 200, y: 200 }, modifiers);
  gestures.finish();
  assert.equal(store.selected.size, 2);
  assert.deepEqual(store.history.future, future);
});
test('canceled pan restores the viewport and never enters document history', () => {
  const { store, gestures } = editor(),
    pan = { ...store.pan };
  gestures.startPan({ x: 100, y: 100 });
  gestures.move({ x: 0, y: 0 }, { x: 180, y: 140 }, modifiers);
  assert.deepEqual(store.pan, { x: pan.x + 80, y: pan.y + 40 });
  gestures.cancel();
  assert.deepEqual(store.pan, pan);
  assert.equal(store.history.past.length, 0);
});
test('editing commands preserve validated documents and atomic undo', () => {
  const { store, commands } = editor(),
    before = clone(store.doc);
  commands.setProperty('fill', '#0d99ff');
  assert.ok(store.doc.nodes.every((n) => n.fill === '#0d99ff'));
  assert.equal(store.history.past.length, 1);
  store.undo();
  assert.deepEqual(store.doc, before);
  store.selected = new Set(store.doc.nodes.map((n) => n.id));
  assert.throws(() => commands.setProperty('width', -1));
  assert.deepEqual(store.doc, before);
  assert.equal(store.history.past.length, 0);
  commands.duplicate();
  assert.equal(store.doc.nodes.length, 4);
  assert.equal(store.selected.size, 2);
  commands.remove();
  assert.equal(store.doc.nodes.length, 2);
  validateDocument(store.doc);
});
test('invalid mutations are rolled back before creating a history entry', () => {
  const { store } = editor(),
    before = clone(store.doc),
    selection = new Set(store.selected);
  assert.throws(() =>
    store.change(() => {
      store.doc.nodes[0].width = -10;
      store.selected.clear();
    }),
  );
  assert.deepEqual(store.doc, before);
  assert.deepEqual(store.selected, selection);
  assert.equal(store.history.past.length, 0);
});
test('clipboard paste is undoable and preserves source data for repeated pastes', () => {
  const { store } = editor(),
    nodes = clone(store.doc.nodes),
    clipboard = new ClipboardController(store, () => {});
  clipboard.nodes = nodes;
  clipboard.paste(true);
  assert.equal(store.doc.nodes.length, 4);
  assert.equal(store.selected.size, 2);
  const copies = store.chosen();
  assert.equal(copies[0].x, nodes[0].x);
  assert.notEqual(copies[0].id, nodes[0].id);
  store.undo();
  assert.equal(store.doc.nodes.length, 2);
  clipboard.paste();
  assert.equal(store.chosen()[0].x, nodes[0].x + 20);
  assert.deepEqual(clipboard.nodes, nodes);
});
test('viewport zoom keeps the world point under the cursor stationary', () => {
  const { store } = editor(),
    viewport = new ViewportController(store),
    anchor = { x: 300, y: 200 };
  const before = viewport.point(anchor, { x: 0, y: 0 });
  viewport.setZoom(2, anchor);
  assert.deepEqual(viewport.point(anchor, { x: 0, y: 0 }), before);
  assert.equal(store.history.past.length, 0);
});
test('autosave adapter retains the existing storage key and document format', () => {
  const values = new Map<string, string>();
  const storage = browserDocumentStorage({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  });
  assert.deepEqual(storage.load(), createDocument());
  const { store } = editor();
  storage.save(store.doc);
  assert.ok(values.has('redesign.document'));
  assert.deepEqual(storage.load(), store.doc);
  values.set('redesign.document', '{"format":"other"}');
  assert.throws(() => storage.load());
});
