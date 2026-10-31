import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createNode, validateDocument } from '../src/model/document.ts';
import { History } from '../src/commands/history.ts';
import { clone } from '../src/model/types.ts';
import type { Alignment, ResizeHandle, Axis } from '../src/model/types.ts';
import { boxBetween, marqueeIds, toggleId } from '../src/model/selection.ts';
import { bounds, fitView } from '../src/model/geometry.ts';
import { translateNodes, resizeBox, resizeNodes, cloneNodes } from '../src/commands/transforms.ts';
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function fixture() {
  const doc = createDocument();
  doc.nodes = [
    createNode('rectangle', { x: -20, y: 0, width: 40, height: 20 }),
    createNode('ellipse', { x: 60, y: 40, width: 80, height: 40 }),
    createNode('text', { x: 200, y: 100, width: 60, height: 20 }),
  ];
  return doc;
}
test('marquee works in reverse directions, includes intersecting layers and excludes outsiders', () => {
  const doc = fixture(),
    box = boxBetween({ x: 100, y: 70 }, { x: -30, y: -10 });
  assert.deepEqual(box, { x: -30, y: -10, width: 130, height: 80 });
  assert.deepEqual(
    marqueeIds(doc.nodes, box),
    doc.nodes.slice(0, 2).map((n) => n.id),
  );
});
test('Shift toggle is immutable and removes only the requested selection', () => {
  const original = new Set(['a', 'b']);
  assert.deepEqual([...toggleId(original, 'a')], ['b']);
  assert.deepEqual([...toggleId(original, 'c')], ['a', 'b', 'c']);
  assert.deepEqual([...original], ['a', 'b']);
});
test('moving multiple layers preserves relative positions and does not move outsiders', () => {
  const doc = fixture(),
    before = clone(doc),
    originals = clone(doc.nodes.slice(0, 2));
  translateNodes(doc, originals, 25, -30);
  assert.equal(doc.nodes[0].x, 5);
  assert.equal(doc.nodes[1].y, 10);
  assert.equal(doc.nodes[1].x - doc.nodes[0].x, 80);
  assert.deepEqual(doc.nodes[2], before.nodes[2]);
  translateNodes(doc, originals, 30, 10); // Pointer updates use the start snapshot, not incremental drift.
  assert.equal(doc.nodes[0].x, 10);
  assert.equal(doc.nodes[0].y, 10);
});
test('all eight resize handles anchor opposite edges and keep dimensions positive', () => {
  const start = { x: 10, y: 20, width: 100, height: 80 };
  for (const handle of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandle[]) {
    const next = resizeBox(start, handle, 15, 10);
    assert.ok(next.width >= 1 && next.height >= 1);
    if (handle.includes('w')) near(next.x + next.width, 110);
    if (handle.includes('e')) near(next.x, 10);
    if (handle.includes('n')) near(next.y + next.height, 100);
    if (handle.includes('s')) near(next.y, 20);
  }
  const crossed = resizeBox(start, 'nw', 1000, 1000);
  assert.equal(crossed.width, 1);
  assert.equal(crossed.height, 1);
  near(crossed.x + crossed.width, 110);
});
test('Shift preserves aspect ratio and Alt preserves center', () => {
  const start = { x: 10, y: 20, width: 100, height: 50 };
  for (const handle of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandle[]) {
    const next = resizeBox(start, handle, 30, 15, { aspect: true, center: true });
    near(next.width / next.height, 2);
    near(next.x + next.width / 2, 60);
    near(next.y + next.height / 2, 45);
  }
});
test('multi resize scales spacing and each box while leaving outsiders intact', () => {
  const doc = fixture(),
    before = clone(doc),
    originals = clone(doc.nodes.slice(0, 2)),
    from = bounds(originals)!;
  resizeNodes(doc, originals, from, {
    x: 0,
    y: 10,
    width: from.width * 2,
    height: from.height * 3,
  });
  assert.equal(doc.nodes[0].width, 80);
  assert.equal(doc.nodes[1].height, 120);
  near(doc.nodes[1].x - doc.nodes[0].x, 160);
  assert.deepEqual(doc.nodes[2], before.nodes[2]);
  validateDocument(doc);
});
test('duplicated and pasted nodes have unique IDs and preserve relative geometry and text', () => {
  const doc = fixture(),
    copy = cloneNodes(doc.nodes, 0, 0),
    offset = cloneNodes(doc.nodes, 20, 20);
  for (let i = 0; i < 3; i++) {
    assert.notEqual(copy[i].id, doc.nodes[i].id);
    assert.equal(copy[i].x, doc.nodes[i].x);
    assert.equal(offset[i].y, doc.nodes[i].y + 20);
    assert.equal(copy[i].text, doc.nodes[i].text);
  }
  const combined = { ...doc, nodes: [...doc.nodes, ...copy, ...offset] };
  validateDocument(combined);
  copy[0].name = 'Changed';
  assert.notEqual(copy[0].name, doc.nodes[0].name);
});
test('three-layer move, resize and duplicate can each be undone as one exact transaction', () => {
  let doc = fixture();
  const history = new History();
  const original = clone(doc);
  history.push(doc);
  translateNodes(doc, clone(doc.nodes), 25, 50);
  const moved = clone(doc);
  history.push(doc);
  const from = bounds(doc.nodes)!;
  resizeNodes(doc, clone(doc.nodes), from, {
    ...from,
    width: from.width * 2,
    height: from.height * 2,
  });
  const resized = clone(doc);
  history.push(doc);
  doc.nodes.push(...cloneNodes(doc.nodes));
  doc = history.undo(doc);
  assert.deepEqual(doc, resized);
  doc = history.undo(doc);
  assert.deepEqual(doc, moved);
  doc = history.undo(doc);
  assert.deepEqual(doc, original);
  doc = history.redo(doc);
  assert.deepEqual(doc, moved);
});
test('fit view centers negative-coordinate content with padding and handles empty selections', () => {
  const box = { x: -500, y: -200, width: 400, height: 200 };
  const view = fitView(box, 1000, 600)!;
  near(view.pan.x + (box.x + box.width / 2) * view.zoom, 500);
  near(view.pan.y + (box.y + box.height / 2) * view.zoom, 300);
  assert.ok(box.width * view.zoom <= 872 + 1e-8);
  assert.ok(box.height * view.zoom <= 472 + 1e-8);
  assert.equal(fitView(null, 1000, 600), null);
  assert.equal(fitView(box, 0, 600), null);
});

import { alignNodes, distributeAlignedNodes, distributeNodes } from '../src/commands/alignment.ts';
import { encodeClipboard, decodeClipboard } from '../src/interop/clipboard-codec.ts';
test('all alignment modes use selection bounds and preserve unselected layers', () => {
  for (const mode of ['left', 'center', 'right', 'top', 'middle', 'bottom'] as Alignment[]) {
    const doc = fixture(),
      before = clone(doc),
      ids = new Set(doc.nodes.slice(0, 2).map((n) => n.id));
    const box = bounds(doc.nodes.slice(0, 2))!;
    alignNodes(doc, ids, mode);
    const [a, b] = doc.nodes;
    if (mode === 'left') assert.equal(a.x, b.x);
    if (mode === 'center') near(a.x + a.width / 2, b.x + b.width / 2);
    if (mode === 'right') near(a.x + a.width, b.x + b.width);
    if (mode === 'top') assert.equal(a.y, b.y);
    if (mode === 'middle') near(a.y + a.height / 2, b.y + b.height / 2);
    if (mode === 'bottom') near(a.y + a.height, b.y + b.height);
    assert.deepEqual(doc.nodes[2], before.nodes[2]);
    near(
      bounds(doc.nodes.slice(0, 2))!.width,
      mode === 'top' || mode === 'middle' || mode === 'bottom' ? box.width : 80,
    );
  }
});
test('distribution equalizes edge gaps without moving endpoints or changing stacking order', () => {
  for (const axis of ['x', 'y'] as Axis[]) {
    const doc = fixture(),
      before = clone(doc),
      size = axis === 'x' ? 'width' : 'height',
      ids = new Set(doc.nodes.map((n) => n.id));
    distributeNodes(doc, ids, axis);
    const [a, b, c] = doc.nodes;
    near(b[axis] - a[axis] - a[size], c[axis] - b[axis] - b[size]);
    assert.equal(a[axis], before.nodes[0][axis]);
    assert.equal(c[axis], before.nodes[2][axis]);
    assert.deepEqual(
      doc.nodes.map((n) => n.id),
      before.nodes.map((n) => n.id),
    );
  }
});
test('distribute objects spaces each selected alignment edge evenly and preserves endpoints', () => {
  for (const mode of ['left', 'center', 'right', 'top', 'middle', 'bottom'] as Alignment[]) {
    const doc = fixture();
    doc.nodes.push(createNode('rectangle', { x: 500, y: 400 }));
    const before = clone(doc),
      ids = new Set(doc.nodes.slice(0, 3).map((n) => n.id)),
      horizontal = mode === 'left' || mode === 'center' || mode === 'right',
      axis = horizontal ? 'x' : 'y',
      size = horizontal ? 'width' : 'height',
      offset =
        mode === 'center' || mode === 'middle'
          ? 0.5
          : mode === 'right' || mode === 'bottom'
            ? 1
            : 0,
      coordinate = (node: (typeof doc.nodes)[number]) => node[axis] + node[size] * offset;
    distributeAlignedNodes(doc, ids, mode);
    const [first, middle, last] = doc.nodes;
    near(first[axis], before.nodes[0][axis]);
    near(last[axis], before.nodes[2][axis]);
    near(coordinate(middle), (coordinate(first) + coordinate(last)) / 2);
    assert.deepEqual(doc.nodes[3], before.nodes[3]);
  }
});
test('clipboard transfers validate data, preserve Unicode and reject foreign or malformed payloads', () => {
  const doc = fixture();
  doc.nodes[2].text = 'नमस्ते <script>literal</script>';
  const encoded = encodeClipboard(doc.nodes),
    decoded = decodeClipboard(encoded);
  assert.deepEqual(decoded, doc.nodes);
  decoded[0].x = 500;
  assert.notEqual(doc.nodes[0].x, 500);
  assert.throws(() => decodeClipboard('{broken'));
  assert.throws(() =>
    decodeClipboard(JSON.stringify({ format: 'other', version: 1, nodes: doc.nodes })),
  );
  assert.throws(() => decodeClipboard(encodeClipboard([{ ...doc.nodes[0], width: -1 }])));
  assert.throws(() => decodeClipboard(encodeClipboard([doc.nodes[0], doc.nodes[0]])));
});
