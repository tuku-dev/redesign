import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createNode, validateDocument } from '../src/model/document.ts';
import { clone } from '../src/model/types.ts';
import { descendants, hierarchyRows, selectionRoots } from '../src/model/hierarchy.ts';
import { EditorStore } from '../src/editor/store.ts';
import { GestureController } from '../src/editor/gestures.ts';
import { EditingCommands } from '../src/commands/editing.ts';
import { encodeClipboard, decodeClipboard } from '../src/interop/clipboard-codec.ts';
import { ClipboardController } from '../src/interop/clipboard-controller.ts';
const modifiers = { aspect: false, center: false };
function setup() {
  const frame = createNode('frame', { x: 0, y: 0, width: 400, height: 300 });
  const square = createNode('rectangle', {
    x: 20,
    y: 30,
    width: 50,
    height: 50,
    parentId: frame.id,
  });
  const nested = createNode('frame', {
    x: 100,
    y: 100,
    width: 150,
    height: 120,
    parentId: frame.id,
  });
  const circle = createNode('ellipse', {
    x: 120,
    y: 120,
    width: 30,
    height: 30,
    parentId: nested.id,
  });
  const outside = createNode('rectangle', { x: 600, y: 0, width: 40, height: 40 });
  const doc = createDocument();
  doc.nodes = [frame, square, nested, circle, outside];
  const store = new EditorStore(doc);
  store.selected = new Set([frame.id]);
  return {
    store,
    gestures: new GestureController(store),
    commands: new EditingCommands(store),
    frame,
    square,
    nested,
    circle,
    outside,
  };
}
test('moving a frame carries every descendant exactly once and undo restores the subtree', () => {
  const { store, gestures, frame } = setup(),
    before = clone(store.doc);
  gestures.startSelection({ x: 0, y: 0 }, frame.id, false);
  gestures.move({ x: 10, y: 20 }, { x: 10, y: 20 }, modifiers);
  gestures.move({ x: 40, y: 60 }, { x: 40, y: 60 }, modifiers);
  gestures.finish();
  for (let i = 0; i < 4; i++) {
    assert.equal(store.doc.nodes[i].x, before.nodes[i].x + 40);
    assert.equal(store.doc.nodes[i].y, before.nodes[i].y + 60);
  }
  assert.deepEqual(store.doc.nodes[4], before.nodes[4]);
  assert.equal(store.history.past.length, 1);
  store.undo();
  assert.deepEqual(store.doc, before);
  store.redo();
  assert.equal(store.doc.nodes[3].x, before.nodes[3].x + 40);
});
test('frame plus child selection does not double-move descendants during nudge or numeric editing', () => {
  const { store, commands, frame, square, circle } = setup();
  store.selected.add(square.id);
  store.selected.add(circle.id);
  commands.nudge(10, 5);
  assert.equal(store.doc.nodes[1].x, square.x + 10);
  assert.equal(store.doc.nodes[3].x, circle.x + 10);
  commands.setProperty('x', 100);
  assert.equal(store.doc.nodes[0].x, 100);
  assert.equal(store.doc.nodes[1].x, square.x + 100);
  assert.equal(store.doc.nodes[3].x, circle.x + 100);
  assert.deepEqual(
    selectionRoots(store.doc, store.selected).map((n) => n.id),
    [frame.id],
  );
});
test('drawing inside a frame assigns parent and drawing a frame around root objects adopts them', () => {
  const { store, gestures, frame } = setup();
  store.tool = 'ellipse';
  gestures.startDrawing({ x: 40, y: 40 });
  gestures.move({ x: 60, y: 60 }, { x: 60, y: 60 }, modifiers);
  gestures.finish();
  assert.equal(store.current()?.parentId, frame.id);
  const solo = createDocument();
  const shape = createNode('rectangle', { x: 20, y: 20, width: 30, height: 30 });
  solo.nodes = [shape];
  const other = new EditorStore(solo),
    drawing = new GestureController(other);
  other.tool = 'frame';
  drawing.startDrawing({ x: 0, y: 0 });
  drawing.move({ x: 100, y: 100 }, { x: 100, y: 100 }, modifiers);
  drawing.finish();
  assert.equal(other.doc.nodes[0].parentId, other.current()?.id);
  assert.deepEqual(
    hierarchyRows(other.doc).map((row) => row.depth),
    [0, 1],
  );
});
test('dragging a layer out of and into a frame reparents it and cancellation restores ownership', () => {
  const { store, gestures, square, frame } = setup();
  store.selected = new Set([square.id]);
  gestures.startSelection({ x: 20, y: 30 }, square.id, false);
  gestures.move({ x: 800, y: 500 }, { x: 800, y: 500 }, modifiers);
  gestures.finish();
  assert.equal(store.current()?.parentId, null);
  gestures.startSelection({ x: 800, y: 500 }, square.id, false);
  gestures.move({ x: 20, y: 30 }, { x: 20, y: 30 }, modifiers);
  gestures.finish();
  assert.equal(store.current()?.parentId, frame.id);
  const before = clone(store.doc);
  gestures.startSelection({ x: 20, y: 30 }, square.id, false);
  gestures.move({ x: 800, y: 500 }, { x: 800, y: 500 }, modifiers);
  gestures.cancel();
  assert.deepEqual(store.doc, before);
});
test('resizing a single frame keeps child sizes and translates contents only when its origin moves', () => {
  const { store, gestures, frame } = setup(),
    before = clone(store.doc);
  gestures.startResize({ x: 400, y: 300 }, 'se');
  gestures.move({ x: 450, y: 350 }, { x: 450, y: 350 }, modifiers);
  gestures.finish();
  assert.equal(store.doc.nodes[0].width, 450);
  for (let i = 1; i < 4; i++) assert.deepEqual(store.doc.nodes[i], before.nodes[i]);
  store.selected = new Set([frame.id]);
  gestures.startResize({ x: 0, y: 0 }, 'nw');
  gestures.move({ x: 20, y: 30 }, { x: 20, y: 30 }, modifiers);
  gestures.finish();
  assert.equal(store.doc.nodes[1].x, before.nodes[1].x + 20);
  assert.equal(store.doc.nodes[1].width, before.nodes[1].width);
});
test('duplicate remaps a complete nested subtree and delete removes descendants with one undo', () => {
  const { store, commands, frame } = setup(),
    before = clone(store.doc);
  commands.duplicate();
  assert.equal(store.doc.nodes.length, 9);
  assert.equal(store.selected.size, 1);
  const copy = store.current()!;
  assert.notEqual(copy.id, frame.id);
  const subtree = descendants(store.doc, store.selected);
  assert.equal(subtree.length, 4);
  assert.equal(subtree.filter((n) => n.parentId === copy.id).length, 2);
  const inner = subtree.find((n) => n.type === 'frame' && n.id !== copy.id)!;
  assert.ok(subtree.some((n) => n.parentId === inner.id));
  commands.remove();
  assert.deepEqual(store.doc, before);
  store.undo();
  assert.equal(store.doc.nodes.length, 9);
});
test('copy/paste preserves internal frame references while copied children detach missing parents', () => {
  const { store, frame, square } = setup();
  const tree = descendants(store.doc, new Set([frame.id]));
  const decoded = decodeClipboard(encodeClipboard(tree));
  assert.equal(decoded[1].parentId, frame.id);
  const child = decodeClipboard(encodeClipboard([square]));
  assert.equal(child[0].parentId, null);
  const target = new EditorStore(),
    clipboard = new ClipboardController(target, () => {});
  clipboard.nodes = decoded;
  clipboard.paste(true);
  assert.equal(target.doc.nodes.length, 4);
  assert.equal(target.selected.size, 1);
  validateDocument(target.doc);
});
test('legacy flat files infer enclosing frames and explicit root layers remain unparented', () => {
  const { store, frame, square, nested, circle } = setup();
  const legacy = {
    ...store.doc,
    nodes: store.doc.nodes.map((n) => {
      const { parentId, ...flat } = n;
      void parentId;
      return flat;
    }),
  };
  const loaded = validateDocument(JSON.parse(JSON.stringify(legacy)));
  assert.equal(loaded.nodes.find((n) => n.id === square.id)?.parentId, frame.id);
  assert.equal(loaded.nodes.find((n) => n.id === circle.id)?.parentId, nested.id);
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(loaded))), loaded);
  const root = { ...square, parentId: null };
  assert.equal(validateDocument({ ...store.doc, nodes: [frame, root] }).nodes[1].parentId, null);
});
test('reject dangling parents, non-frame parents and cycles without damaging the current document', () => {
  const { store, commands, frame, square, nested } = setup(),
    before = clone(store.doc);
  assert.throws(() => commands.setParent(nested.id));
  assert.deepEqual(store.doc, before);
  for (const parentId of ['missing', square.id, frame.id]) {
    const invalid = clone(store.doc);
    invalid.nodes[0].parentId = parentId;
    assert.throws(() => validateDocument(invalid));
  }
});
test('manual reparenting preserves canvas position and sibling reorder stays inside the frame', () => {
  const { store, commands, square, nested, frame } = setup();
  store.selected = new Set([square.id]);
  const before = clone(store.doc.nodes[1]);
  commands.setParent(nested.id);
  const child = store.current()!;
  assert.equal(child.x, before.x);
  assert.equal(child.parentId, nested.id);
  commands.setParent(frame.id);
  commands.reorder(1);
  assert.equal(store.current()?.parentId, frame.id);
  validateDocument(store.doc);
});
test('alignment translates frame descendants and hierarchy order paints parents before children', () => {
  const { store, commands, frame, outside } = setup();
  store.selected = new Set([frame.id, outside.id]);
  commands.align('right');
  assert.equal(store.doc.nodes[0].x, 240);
  assert.equal(store.doc.nodes[1].x, 260);
  assert.equal(store.doc.nodes[3].x, 360);
  const rows = hierarchyRows(store.doc);
  assert.deepEqual(
    rows.map((row) => row.depth),
    [0, 1, 1, 2, 0],
  );
});
