import test from 'node:test';
import assert from 'node:assert/strict';
import { snapTranslation, snapPoint, snapToGrid } from '../src/model/snapping.ts';
import { createDocument, createNode, validateDocument } from '../src/model/document.ts';
import { EditorStore } from '../src/editor/store.ts';
import { GestureController } from '../src/editor/gestures.ts';
import { NodeOptionCommands } from '../src/commands/node-options.ts';
import { EditingCommands } from '../src/commands/editing.ts';
import { SelectionCommands } from '../src/commands/selection.ts';
import { constrainAxis } from '../src/model/constraints.ts';
import { center, rotatePoint, corners, pointInNode, visualBox } from '../src/model/rotation.ts';
import { documentVisualBounds } from '../src/model/render-bounds.ts';
import { withinClips } from '../src/model/clipping.ts';
import { wrapText, graphemes } from '../src/model/text-layout.ts';
import { TextEditSession } from '../src/editor/text-edit.ts';
import { clone } from '../src/model/types.ts';
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const modifiers = { aspect: false, center: false };
function frameEditor() {
  const doc = createDocument(),
    frame = createNode('frame', { x: 0, y: 0, width: 100, height: 100 }),
    child = createNode('rectangle', { x: 10, y: 10, width: 20, height: 20, parentId: frame.id });
  doc.nodes = [frame, child];
  const store = new EditorStore(doc);
  store.selected = new Set([frame.id]);
  return {
    store,
    frame,
    child,
    gestures: new GestureController(store),
    options: new NodeOptionCommands(store),
    commands: new EditingCommands(store),
  };
}
test('move snapping aligns edges/centers and maintains a six-screen-pixel tolerance', () => {
  const box = { x: 0, y: 0, width: 20, height: 20 },
    candidate = { x: 100, y: 0, width: 40, height: 40 };
  const snapped = snapTranslation(box, [candidate], 79, 0, 1);
  assert.equal(snapped.dx, 80);
  assert.ok(snapped.guides.some((g) => g.axis === 'x' && g.position === 100));
  assert.equal(snapTranslation(box, [candidate], 77, 0, 1).dx, 80);
  assert.equal(snapTranslation(box, [candidate], 77, 0, 4).dx, 77);
  assert.equal(snapTranslation(box, [candidate], 79, 0, 1, false).dx, 79);
});
test('equal-spacing snapping balances gaps and shows both measurements', () => {
  const result = snapTranslation(
    { x: 47, y: 0, width: 20, height: 20 },
    [
      { x: 0, y: 0, width: 20, height: 20 },
      { x: 100, y: 0, width: 20, height: 20 },
    ],
    0,
    0,
    1,
  );
  assert.equal(result.dx, 3);
  assert.equal(result.measurements.filter((m) => m.value === 30).length, 2);
});
test('drawing/resize points snap to candidate geometry without snapping distant pointers', () => {
  const candidate = { x: 100, y: 100, width: 40, height: 40 };
  assert.deepEqual(snapPoint({ x: 99, y: 121 }, [candidate], 1).point, { x: 100, y: 120 });
  assert.deepEqual(snapPoint({ x: 50, y: 50 }, [candidate], 1).point, { x: 50, y: 50 });
});
test('grid snapping aligns moves and drawing points independently of geometry snapping', () => {
  const moved = snapTranslation({ x: 0, y: 0, width: 20, height: 20 }, [], 5, 5, 1, false, 8);
  assert.deepEqual({ dx: moved.dx, dy: moved.dy }, { dx: 6, dy: 6 });
  assert.deepEqual(snapToGrid({ x: 23, y: 34 }, 8, 1).point, { x: 24, y: 32 });
  assert.deepEqual(snapToGrid({ x: 21, y: 37 }, 8, 4).point, { x: 21, y: 37 });
});
test('drawing starts and ends on the grid when grid snapping is enabled', () => {
  const { store, gestures } = frameEditor();
  store.selected.clear();
  store.tool = 'rectangle';
  store.gridSnappingEnabled = true;
  gestures.startDrawing({ x: 13, y: 19 });
  assert.deepEqual({ x: store.current()!.x, y: store.current()!.y }, { x: 16, y: 16 });
  gestures.move({ x: 35, y: 43 }, { x: 35, y: 43 }, modifiers);
  assert.deepEqual(
    { width: store.current()!.width, height: store.current()!.height },
    { width: 16, height: 24 },
  );
  gestures.cancel();
});
test('drag guides are transient, Ctrl bypasses snapping, and finish creates one undo step', () => {
  const doc = createDocument(),
    moving = createNode('rectangle', { x: 0, y: 0, width: 20, height: 20 }),
    target = createNode('rectangle', { x: 100, y: 0, width: 40, height: 40 });
  doc.nodes = [moving, target];
  const store = new EditorStore(doc),
    g = new GestureController(store);
  g.startSelection({ x: 0, y: 0 }, moving.id, false);
  g.move({ x: 79, y: 0 }, { x: 79, y: 0 }, modifiers);
  assert.equal(store.current()?.x, 80);
  assert.ok(g.guides.length);
  g.move({ x: 79, y: 0 }, { x: 79, y: 0 }, { ...modifiers, disableSnap: true });
  assert.equal(store.current()?.x, 79);
  assert.equal(g.guides.length, 0);
  g.finish();
  assert.equal(store.history.past.length, 1);
  assert.equal(g.measurements.length, 0);
  store.undo();
  assert.equal(store.doc.nodes[0].x, 0);
});
test('numeric rotation rotates a frame subtree about the frame center and persists through undo', () => {
  const { store, options } = frameEditor(),
    before = clone(store.doc);
  options.set('rotation', 90);
  near(store.doc.nodes[1].x, 70);
  near(store.doc.nodes[1].y, 10);
  near(store.doc.nodes[1].rotation, 90);
  assert.equal(store.doc.nodes[0].rotation, 90);
  store.undo();
  assert.deepEqual(store.doc, before);
  store.redo();
  near(store.doc.nodes[1].x, 70);
});
test('rotation handle supports 15-degree Shift snapping and Escape restores the subtree', () => {
  const { store, gestures } = frameEditor(),
    before = clone(store.doc),
    pivot = { x: 50, y: 50 },
    start = { x: 50, y: -30 },
    next = rotatePoint(start, pivot, 23);
  gestures.startRotate(start);
  gestures.move(next, next, { ...modifiers, aspect: true });
  near(store.doc.nodes[0].rotation, 30);
  gestures.cancel();
  assert.deepEqual(store.doc, before);
  assert.equal(store.history.past.length, 0);
});
test('rotated resize anchors the opposite edge in world space', () => {
  const node = createNode('rectangle', { x: 0, y: 0, width: 100, height: 50, rotation: 90 }),
    doc = createDocument();
  doc.nodes = [node];
  const store = new EditorStore(doc);
  store.selected = new Set([node.id]);
  const g = new GestureController(store),
    start = rotatePoint({ x: 100, y: 25 }, center(node), 90),
    next = rotatePoint({ x: 120, y: 25 }, center(node), 90);
  g.startResize(start, 'e');
  g.move(next, next, modifiers);
  g.finish();
  const resized = store.current()!;
  near(resized.width, 120);
  const fixed = rotatePoint(
    { x: resized.x, y: resized.y + resized.height / 2 },
    center(resized),
    90,
  );
  near(fixed.x, 50);
  near(fixed.y, -25);
});
test('rotated bounds and point hit testing use transformed geometry', () => {
  const n = createNode('rectangle', { x: 0, y: 0, width: 100, height: 20, rotation: 90 }),
    box = visualBox(n);
  near(box.width, 20);
  near(box.height, 100);
  assert.equal(pointInNode({ x: 50, y: 50 }, n), true);
  assert.equal(pointInNode({ x: 0, y: 0 }, n), false);
  assert.equal(corners(n).length, 4);
});
test('all five axis constraints preserve intended offsets and clamp stretched sizes', () => {
  assert.deepEqual(constrainAxis(10, 20, 100, 200, 'start'), { position: 10, size: 20 });
  assert.deepEqual(constrainAxis(10, 20, 100, 200, 'end'), { position: 110, size: 20 });
  assert.deepEqual(constrainAxis(10, 20, 100, 200, 'center'), { position: 60, size: 20 });
  assert.deepEqual(constrainAxis(10, 20, 100, 200, 'stretch'), { position: 10, size: 120 });
  assert.deepEqual(constrainAxis(10, 20, 100, 200, 'scale'), { position: 20, size: 40 });
  assert.equal(constrainAxis(10, 20, 100, 1, 'stretch').size, 1);
});
test('numeric frame resize applies child constraints on both axes and undo is atomic', () => {
  const { store, commands, child } = frameEditor();
  store.doc.nodes[1].constraintX = 'end';
  store.doc.nodes[1].constraintY = 'stretch';
  const before = clone(store.doc);
  commands.setProperty('width', 200);
  assert.equal(store.doc.nodes[1].x, child.x + 100);
  assert.equal(store.doc.nodes[1].width, 20);
  store.undo();
  assert.deepEqual(store.doc, before);
  store.selected = new Set([store.doc.nodes[0].id]);
  commands.setProperty('height', 200);
  assert.equal(store.doc.nodes[1].height, 120);
});
test('constraints propagate through nested frames and preserve rotated parent axes', () => {
  const { store, commands, options, child } = frameEditor();
  const inner = store.doc.nodes[1];
  inner.type = 'frame';
  inner.constraintX = 'stretch';
  const grandchild = createNode('ellipse', {
    x: 15,
    y: 15,
    width: 5,
    height: 5,
    parentId: child.id,
    constraintX: 'end',
  });
  store.doc.nodes.push(grandchild);
  commands.setProperty('width', 200);
  assert.equal(store.doc.nodes[2].x, 115);
  options.set('rotation', 90);
  const prior = clone(store.doc),
    frame = store.doc.nodes[0],
    pivot = center(frame);
  commands.setProperty('width', 300);
  const localBefore = rotatePoint(center(prior.nodes[1]), pivot, -90),
    localAfter = rotatePoint(center(store.doc.nodes[1]), center(store.doc.nodes[0]), -90);
  near(localAfter.x - store.doc.nodes[0].x - (localBefore.x - prior.nodes[0].x), 50);
});
test('clipping prevents out-of-frame hit selection and export bounds exclude clipped overflow', () => {
  const { store, frame, child } = frameEditor();
  store.doc.nodes[1].x = 80;
  store.doc.nodes[1].y = 80;
  store.doc.nodes[1].width = 40;
  store.doc.nodes[1].height = 40;
  const n = store.doc.nodes[1];
  assert.equal(withinClips(store.doc, n, { x: 110, y: 110 }), false);
  assert.equal(withinClips(store.doc, n, { x: 90, y: 90 }), true);
  assert.ok(!new SelectionCommands(store).at({ x: 110, y: 110 }).includes(child.id));
  assert.deepEqual(documentVisualBounds(store.doc), { x: 0, y: 0, width: 100, height: 100 });
  store.doc.nodes[0].clipContent = false;
  assert.equal(documentVisualBounds(store.doc)?.width, 120);
  assert.equal(frame.clipContent, true);
});
test('word wrapping preserves explicit empty lines and breaks long words at grapheme boundaries', () => {
  const measure = (s: string) => graphemes(s).length;
  assert.deepEqual(wrapText('Hello world', 5, measure), ['Hello', 'world']);
  assert.deepEqual(wrapText('abcdef', 3, measure), ['abc', 'def']);
  assert.deepEqual(wrapText('a\n\nb', 5, measure), ['a', '', 'b']);
  const emoji = '👨‍👩‍👧‍👦';
  assert.equal(graphemes(emoji).length, 1);
  assert.deepEqual(wrapText(emoji + emoji, 1, measure), [emoji, emoji]);
});
test('inline text previews do not autosave until commit, and cancel restores exact content', () => {
  const doc = createDocument(),
    text = createNode('text', { text: 'Original' });
  doc.nodes = [text];
  const store = new EditorStore(doc),
    session = new TextEditSession(store);
  let saves = 0;
  store.subscribe((update) => {
    if (update.persist) saves++;
  });
  assert.equal(session.start(text.id), true);
  session.update('One');
  session.update('Two\nनमस्ते');
  assert.equal(store.doc.nodes[0].text, 'Two\nनमस्ते');
  assert.equal(saves, 0);
  assert.equal(store.history.past.length, 0);
  session.cancel();
  assert.equal(store.doc.nodes[0].text, 'Original');
  assert.equal(store.editingTextId, null);
  session.start(text.id);
  session.update('Final');
  session.commit();
  assert.equal(saves, 1);
  assert.equal(store.history.past.length, 1);
  store.undo();
  assert.equal(store.doc.nodes[0].text, 'Original');
});
test('text typography options serialize and validation rejects invalid values', () => {
  const doc = createDocument(),
    n = createNode('text');
  doc.nodes = [n];
  const store = new EditorStore(doc);
  store.selected = new Set([n.id]);
  const options = new NodeOptionCommands(store);
  options.set('fontFamily', 'Georgia');
  options.set('fontStyle', 'italic');
  options.set('fontWeight', 700);
  options.set('textWrap', 'word');
  options.set('lineHeight', 1.5);
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(store.doc))), store.doc);
  assert.throws(() => options.set('lineHeight', 0));
  assert.throws(() => options.set('fontFamily', ''));
  assert.throws(() =>
    validateDocument({ ...store.doc, nodes: [{ ...store.doc.nodes[0], constraintX: 'unknown' }] }),
  );
});
test('older documents receive safe defaults for all new options without losing text', () => {
  const n = createNode('text', { text: 'Legacy' }),
    legacy = {
      id: n.id,
      type: n.type,
      name: n.name,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      fill: n.fill,
      opacity: n.opacity,
      radius: n.radius,
      text: n.text,
      fontSize: n.fontSize,
    };
  const loaded = validateDocument({
    format: 'redesign',
    version: 1,
    name: 'Legacy',
    nodes: [legacy],
  });
  assert.equal(loaded.nodes[0].rotation, 0);
  assert.equal(loaded.nodes[0].fontFamily, 'Arial');
  assert.equal(loaded.nodes[0].text, 'Legacy');
  assert.equal(loaded.nodes[0].constraintX, 'start');
});

test('resize snapping targets the actual edge when the pointer grabs off-center on a handle', () => {
  const doc = createDocument(),
    moving = createNode('rectangle', { x: 0, y: 0, width: 50, height: 30 }),
    target = createNode('rectangle', { x: 100, y: 100, width: 20, height: 20 });
  doc.nodes = [moving, target];
  const store = new EditorStore(doc);
  store.selected = new Set([moving.id]);
  const gestures = new GestureController(store);
  gestures.startResize({ x: 53, y: 15 }, 'e');
  gestures.move({ x: 102, y: 15 }, { x: 102, y: 15 }, modifiers);
  gestures.finish();
  near(store.current()!.width, 100);
});

test('marquee does not select children that are completely outside a clipped frame', () => {
  const { store, gestures } = frameEditor();
  store.doc.nodes[1].x = 200;
  store.doc.nodes[1].y = 200;
  gestures.startSelection({ x: 190, y: 190 }, null, false);
  gestures.move({ x: 240, y: 240 }, { x: 240, y: 240 }, modifiers);
  gestures.finish();
  assert.equal(store.selected.size, 0);
});
