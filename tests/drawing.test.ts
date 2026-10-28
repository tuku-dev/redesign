import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorStore } from '../src/editor/store.ts';
import { GestureController } from '../src/editor/gestures.ts';
import { drawingBox } from '../src/model/drawing.ts';

test('perfect drawing keeps equal dimensions and the origin anchored in every drag direction', () => {
  for (const [dx, dy] of [
    [70, 25],
    [-70, 25],
    [70, -25],
    [-70, -25],
    [0, 70],
    [70, 0],
  ]) {
    const box = drawingBox({ x: 100, y: 100 }, { x: 100 + dx, y: 100 + dy }, true);
    assert.equal(box.width, 70);
    assert.equal(box.height, 70);
    assert.equal(box.x, dx < 0 ? 30 : 100);
    assert.equal(box.y, dy < 0 ? 30 : 100);
  }
  assert.deepEqual(drawingBox({ x: 10, y: 20 }, { x: 10, y: 20 }, true), {
    x: 10,
    y: 20,
    width: 1,
    height: 1,
  });
});
test('Ctrl-constrained rectangle and ellipse creation survives undo and redo', () => {
  for (const type of ['rectangle', 'ellipse'] as const) {
    const store = new EditorStore(),
      gestures = new GestureController(store);
    store.tool = type;
    gestures.startDrawing({ x: 10, y: 20 });
    gestures.move(
      { x: 90, y: 50 },
      { x: 90, y: 50 },
      { aspect: false, center: false, perfect: true },
    );
    gestures.finish();
    assert.equal(store.current()?.width, 80);
    assert.equal(store.current()?.height, 80);
    assert.equal(store.current()?.type, type);
    assert.equal(store.history.past.length, 1);
    store.undo();
    assert.equal(store.doc.nodes.length, 0);
    store.redo();
    assert.equal(store.doc.nodes[0].height, 80);
  }
});
test('releasing Ctrl returns to free proportions and frames retain normal drawing', () => {
  const store = new EditorStore(),
    gestures = new GestureController(store);
  store.tool = 'ellipse';
  gestures.startDrawing({ x: 0, y: 0 });
  gestures.move(
    { x: 80, y: 30 },
    { x: 80, y: 30 },
    { aspect: false, center: false, perfect: true },
  );
  assert.equal(store.current()?.height, 80);
  gestures.move(
    { x: 80, y: 30 },
    { x: 80, y: 30 },
    { aspect: false, center: false, perfect: false },
  );
  assert.equal(store.current()?.height, 30);
  gestures.finish();
  store.tool = 'frame';
  gestures.startDrawing({ x: 200, y: 200 });
  gestures.move(
    { x: 280, y: 230 },
    { x: 280, y: 230 },
    { aspect: false, center: false, perfect: true },
  );
  gestures.finish();
  assert.equal(store.current()?.width, 80);
  assert.equal(store.current()?.height, 30);
});
