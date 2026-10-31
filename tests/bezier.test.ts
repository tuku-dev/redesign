import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bezierBounds,
  bezierPathData,
  cubicPoint,
  flattenRing,
  mapVectorPoint,
  moveAnchor,
  moveHandle,
  pointKind,
} from '../src/model/bezier.ts';
import { createNode, createDocument, validateDocument } from '../src/model/document.ts';
import {
  vectorFromPoints,
  pathData,
  normalizeVector,
  shapeRings,
  booleanRings,
} from '../src/model/vector.ts';
import { center, rotatePoint } from '../src/model/rotation.ts';
import { EditorStore } from '../src/editor/store.ts';
import { FeatureCommands } from '../src/commands/features.ts';
import type { VectorPoint } from '../src/model/features.ts';
const arch = (): VectorPoint[] => [
  { x: 0, y: 0, out: { x: 0, y: 100 } },
  { x: 100, y: 0, in: { x: 100, y: 100 } },
];
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
test('cubic extrema produce tight curve bounds rather than anchor-only or control-hull bounds', () => {
  assert.deepEqual(bezierBounds([arch()], false), { x: 0, y: 0, width: 100, height: 75 });
  const p = cubicPoint(arch()[0], arch()[0].out!, arch()[1].in!, arch()[1], 0.5);
  assert.deepEqual(p, { x: 50, y: 75 });
});
test('curve path serialization preserves cubic controls and curved closing segments', () => {
  const ring = arch();
  ring[0].in = { x: 0, y: -100 };
  ring[1].out = { x: 100, y: -100 };
  const d = bezierPathData([ring], true);
  assert.equal((d.match(/C /g) ?? []).length, 2);
  assert.ok(d.endsWith('Z'));
  assert.ok(d.includes('C 100 -100 0 -100 0 0'));
});
test('straight legacy paths keep line commands and need no new fields', () => {
  const ring = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];
  assert.equal(bezierPathData([ring], true), 'M 0 0 L 100 0 L 100 100 Z');
  const n = createNode('path', { ...vectorFromPoints([ring], true) });
  assert.deepEqual(n.vector?.rings[0], [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ]);
});
test('normalizing curves retains handles outside tight bounds and SVG uses cubic segments', () => {
  const n = createNode('path', { ...vectorFromPoints([arch()], false) });
  assert.equal(n.height, 75);
  near(n.vector!.rings[0][0].out!.y, 4 / 3);
  assert.ok(pathData(n).includes('C 0 100 100 100 100 0'));
  const doc = { ...createDocument(), nodes: [n] };
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(doc))), doc);
});
test('moving an anchor carries both handles without changing their offsets', () => {
  const p: VectorPoint = { x: 10, y: 20, in: { x: 5, y: 10 }, out: { x: 15, y: 30 }, smooth: true };
  moveAnchor(p, { x: 40, y: 50 });
  assert.deepEqual(p.in, { x: 35, y: 40 });
  assert.deepEqual(p.out, { x: 45, y: 60 });
});
test('smooth handles stay collinear and preserve the other handle length in document units', () => {
  const p: VectorPoint = {
    x: 0.5,
    y: 0.5,
    in: { x: 0.25, y: 0.5 },
    out: { x: 0.75, y: 0.5 },
    smooth: true,
  };
  moveHandle(p, 'out', { x: 0.5, y: 1 }, false, { x: 200, y: 100 });
  near(p.in!.x, 0.5);
  near(p.in!.y, 0);
});
test('Alt-style independent handle movement breaks mirroring and preserves the other handle', () => {
  const p: VectorPoint = { x: 0, y: 0, in: { x: -10, y: 0 }, out: { x: 10, y: 0 }, smooth: true };
  moveHandle(p, 'out', { x: 10, y: 20 }, true);
  assert.deepEqual(p.in, { x: -10, y: 0 });
  assert.equal(p.smooth, false);
});
test('corner and smooth conversions are reversible commands with undo and lock protection', () => {
  const s = new EditorStore(),
    c = new FeatureCommands(s);
  c.path(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    true,
  );
  c.pointKind(0, 1, true);
  assert.ok(s.current()?.vector?.rings[0][1].in);
  c.pointKind(0, 1, false);
  assert.equal(s.current()?.vector?.rings[0][1].in, undefined);
  s.undo();
  const n = s.doc.nodes[0];
  assert.ok(n.vector?.rings[0][1].in);
  s.selected = new Set([n.id]);
  n.locked = true;
  const before = structuredClone(s.doc);
  c.pointKind(0, 1, false);
  assert.deepEqual(s.doc, before);
});
test('adaptive flattening follows curves for booleans and retains an arch area', () => {
  const ring = arch(),
    flat = flattenRing(ring, true);
  assert.ok(flat.length > 10);
  assert.ok(flat.some((p) => p.y > 74));
  const n = createNode('path', { ...vectorFromPoints([ring], true) }),
    other = createNode('rectangle', { x: -10, y: -10, width: 120, height: 100 });
  const rings = booleanRings([n, other], 'intersection');
  assert.ok(rings[0].some((p) => p.y > 74));
  const points = shapeRings(n)[0];
  const area = Math.abs(
    points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length];
      return sum + p.x * q.y - q.x * p.y;
    }, 0) / 2,
  );
  assert.ok(Math.abs(area - 6000) < 30);
});
test('reboxing a rotated edited curve preserves cubic world positions and is idempotent', () => {
  const n = createNode('path', { ...vectorFromPoints([arch()], false), rotation: 35 });
  n.vector!.rings[0][0].out!.y = 2;
  const old = structuredClone(n);
  const sample = (node: typeof n, t: number) => {
    const [a, d] = node.vector!.rings[0].map((p) =>
      mapVectorPoint(p, (q) => ({ x: node.x + q.x * node.width, y: node.y + q.y * node.height })),
    );
    return rotatePoint(cubicPoint(a, a.out ?? a, d.in ?? d, d, t), center(node), node.rotation);
  };
  normalizeVector(n);
  for (const t of [0, 0.2, 0.5, 0.8, 1]) {
    const a = sample(old, t),
      b = sample(n, t);
    near(a.x, b.x);
    near(a.y, b.y);
  }
  const once = structuredClone(n);
  normalizeVector(n);
  assert.deepEqual(n, once);
});
test('malformed handles and smoothing flags are rejected during document import', () => {
  const n = createNode('path', { ...vectorFromPoints([arch()], false) });
  for (const extra of [
    { out: { x: NaN, y: 0 } },
    { in: { x: 0 } },
    { out: 'bad' },
    { smooth: 'yes' },
  ]) {
    const bad = structuredClone(n);
    Object.assign(bad.vector!.rings[0][0], extra);
    assert.throws(() => validateDocument({ ...createDocument(), nodes: [bad] }));
  }
});
test('anchor and handle commands preserve editability across undo and redo', () => {
  const s = new EditorStore(),
    c = new FeatureCommands(s);
  c.path(arch(), false);
  const before = structuredClone(s.doc),
    id = s.current()!.id;
  c.handle(0, 0, 'out', { x: 0.3, y: 1 });
  const after = structuredClone(s.doc);
  assert.notDeepEqual(before, after);
  s.undo();
  assert.deepEqual(s.doc, before);
  s.redo();
  assert.deepEqual(s.doc, after);
  s.selected = new Set([id]);
  const anchor = s.current()!.vector!.rings[0][0],
    offset = (anchor.out!.x - anchor.x) * s.current()!.width;
  c.vertex(0, 0, { x: anchor.x + 0.1, y: anchor.y });
  const edited = s.current()!;
  near((edited.vector!.rings[0][0].out!.x - edited.vector!.rings[0][0].x) * edited.width, offset);
});
test('point smoothing handles open endpoints and closed rings without mutating other anchors', () => {
  const ring: VectorPoint[] = [
      { x: 0, y: 0 },
      { x: 30, y: 30 },
      { x: 60, y: 0 },
    ],
    before = structuredClone(ring[1]);
  pointKind(ring, 0, true, false);
  assert.ok(ring[0].out);
  assert.deepEqual(ring[1], before);
  pointKind(ring, 2, true, true);
  assert.ok(ring[2].in);
  pointKind(ring, 2, false, true);
  assert.equal(ring[2].out, undefined);
});
