import test from 'node:test';
import assert from 'node:assert/strict';
import { cubicPoint } from '../src/model/bezier.ts';
import {
  insertVectorPoint,
  deleteVectorPoint,
  segmentParameter,
} from '../src/model/vector-edit.ts';
import type { VectorPath } from '../src/model/features.ts';
import { createDocument, createNode } from '../src/model/document.ts';
import { EditorStore } from '../src/editor/store.ts';
import { FeatureCommands } from '../src/commands/features.ts';
const curve = (): VectorPath => ({
  closed: false,
  fillRule: 'nonzero',
  rings: [
    [
      { x: 0, y: 0, out: { x: 0.2, y: 1 } },
      { x: 1, y: 0, in: { x: 0.8, y: 1 } },
    ],
  ],
});
test('inserting a cubic anchor preserves every sampled point exactly on both subcurves', () => {
  const path = curve(),
    before = structuredClone(path),
    split = 0.37;
  insertVectorPoint(path, 0, 0, split);
  const [a, m, b] = path.rings[0];
  for (let i = 0; i <= 100; i++) {
    const t = i / 100,
      expected = cubicPoint(
        before.rings[0][0],
        before.rings[0][0].out!,
        before.rings[0][1].in!,
        before.rings[0][1],
        t,
      );
    const actual =
      t <= split
        ? cubicPoint(a, a.out!, m.in!, m, t / split)
        : cubicPoint(m, m.out!, b.in!, b, (t - split) / (1 - split));
    assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) < 1e-12);
  }
  assert.equal(path.fillRule, 'nonzero');
  assert.equal(m.smooth, true);
});
test('straight and curved closing segments insert anchors without breaking closure or first incoming handle', () => {
  const path: VectorPath = {
    closed: true,
    rings: [
      [
        { x: 0, y: 0, in: { x: -1, y: 1 } },
        { x: 1, y: 0 },
        { x: 1, y: 1, out: { x: 0, y: 2 } },
      ],
    ],
  };
  insertVectorPoint(path, 0, 2, 0.5);
  assert.equal(path.rings[0].length, 4);
  assert.ok(path.rings[0][0].in);
  assert.ok(path.rings[0][3].out);
  const line: VectorPath = {
    closed: false,
    rings: [
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    ],
  };
  insertVectorPoint(line, 0, 0);
  assert.deepEqual(line.rings[0][1], { x: 0.5, y: 0.5, radius: 0 });
  assert.throws(() => insertVectorPoint(line, 0, 2), /valid path segment/);
});
test('deleting points keeps a usable path, cleans endpoint handles and removes only an exhausted compound ring', () => {
  const p = curve();
  assert.throws(() => deleteVectorPoint(p, 0, 0), /at least two/);
  insertVectorPoint(p, 0, 0);
  deleteVectorPoint(p, 0, 0);
  assert.equal(p.rings[0][0].in, undefined);
  const compound = curve();
  compound.rings.push([
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ]);
  deleteVectorPoint(compound, 1, 0);
  assert.equal(compound.rings.length, 1);
  assert.equal(compound.rings[0].length, 2);
});
test('segment picking accounts for display aspect ratio and follows the original cubic', () => {
  const p = curve().rings[0],
    t = 0.73,
    q = cubicPoint(p[0], p[0].out!, p[1].in!, p[1], t);
  assert.ok(Math.abs(segmentParameter(p[0], p[1], q, { x: 400, y: 20 }) - t) < 1e-5);
});
test('point insert/delete are single undoable edits and locked vectors cannot change', () => {
  const doc = createDocument();
  doc.nodes = [createNode('path', { id: 'p', vector: curve(), rotation: 30 })];
  const store = new EditorStore(doc);
  store.selected.add('p');
  const commands = new FeatureCommands(store),
    before = structuredClone(store.doc);
  commands.insertVertex(0, 0);
  assert.equal(store.current()!.vector!.rings[0].length, 3);
  store.undo();
  assert.deepEqual(store.doc, before);
  store.redo();
  store.selected.add('p');
  commands.deleteVertex(0, 1);
  assert.equal(store.current()!.vector!.rings[0].length, 2);
  store.current()!.locked = true;
  const locked = structuredClone(store.doc);
  commands.insertVertex(0, 0);
  commands.deleteVertex(0, 0);
  assert.deepEqual(store.doc, locked);
});
