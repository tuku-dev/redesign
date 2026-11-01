import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createNode, validateDocument } from '../src/model/document.ts';
import { EditorStore } from '../src/editor/store.ts';
import { MaskCommands } from '../src/commands/masks.ts';
import { OutlineCommands } from '../src/commands/outline.ts';
import { EditingCommands } from '../src/commands/editing.ts';
import { defaultAppearance } from '../src/model/features.ts';
import { withinClips } from '../src/model/clipping.ts';
import { strokeOutline } from '../src/model/stroke-outline.ts';
import { insideRing } from '../src/model/vector.ts';
import { clippedVisualBox } from '../src/model/render-bounds.ts';
const editor = () => {
  const doc = createDocument();
  doc.nodes = [
    createNode('ellipse', { id: 'mask', x: 0, y: 0, width: 100, height: 100 }),
    createNode('rectangle', { id: 'art', x: 0, y: 0, width: 200, height: 100, fill: '#ff0000' }),
  ];
  return new EditorStore(doc);
};
test('outline masks preserve hierarchy, clip hit testing and export bounds, and undo as one operation', () => {
  const s = editor(),
    before = structuredClone(s.doc);
  s.selected = new Set(['mask', 'art']);
  new MaskCommands(s).create();
  const owner = s.current()!,
    art = s.doc.nodes.find((n) => n.id === 'art')!;
  assert.equal(owner.maskId, 'mask');
  assert.equal(art.parentId, owner.id);
  assert.equal(withinClips(s.doc, art, { x: 50, y: 50 }), true);
  assert.equal(withinClips(s.doc, art, { x: 1, y: 1 }), false);
  assert.equal(withinClips(s.doc, art, { x: 150, y: 50 }), false);
  assert.equal(
    withinClips(
      s.doc,
      s.doc.nodes.find((n) => n.id === 'mask')!,
      { x: 50, y: 50 },
    ),
    false,
  );
  assert.equal(clippedVisualBox(s.doc, art)!.width, 100);
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(s.doc))), s.doc);
  s.undo();
  assert.deepEqual(s.doc, before);
});
test('duplicating masks remaps ownership and deleting a mask safely releases its container', () => {
  const s = editor();
  s.selected = new Set(['mask', 'art']);
  new MaskCommands(s).create();
  new EditingCommands(s).duplicate();
  const copy = s.current()!;
  assert.notEqual(copy.maskId, 'mask');
  assert.ok(s.doc.nodes.some((n) => n.id === copy.maskId && n.parentId === copy.id));
  s.selected = new Set([copy.maskId!]);
  new EditingCommands(s).remove();
  assert.equal(s.doc.nodes.find((n) => n.id === copy.id)!.maskId, undefined);
  s.undo();
  assert.ok(s.doc.nodes.find((n) => n.id === copy.id)!.maskId);
});
test('mask reference validation and lock protection prevent invalid container mutations', () => {
  const s = editor();
  s.doc.nodes[0].locked = true;
  s.selected = new Set(['mask', 'art']);
  assert.throws(() => new MaskCommands(s).create(), /Unlock/);
  s.doc.nodes.push(createNode('group', { maskId: 'missing' }));
  assert.throws(() => validateDocument(s.doc), /mask reference/);
});
test('solid round line outlines have expected area and retain an inner hole for a closed stroke', () => {
  const a = { ...defaultAppearance(), strokeWidth: 10 },
    line = createNode('path', {
      x: 0,
      y: 0,
      width: 100,
      height: 1,
      appearance: a,
      vector: {
        closed: false,
        rings: [
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        ],
      },
    }),
    rings = strokeOutline(line);
  const area = Math.abs(
    rings[0].reduce(
      (sum, p, i, r) => sum + p.x * r[(i + 1) % r.length].y - r[(i + 1) % r.length].x * p.y,
      0,
    ) / 2,
  );
  assert.ok(Math.abs(area - (1000 + Math.PI * 25)) < 2);
  const rect = strokeOutline(
    createNode('rectangle', { x: 0, y: 0, width: 100, height: 100, appearance: a }),
  );
  assert.equal(rect.filter((r) => insideRing({ x: 50, y: 50 }, r)).length % 2, 0);
  assert.equal(rect.filter((r) => insideRing({ x: 0, y: 50 }, r)).length % 2, 1);
});
test('outlining preserves the fill and opacity and is undoable without changing the original stroke color', () => {
  const doc = createDocument();
  doc.nodes = [
    createNode('rectangle', {
      id: 'r',
      opacity: 0.5,
      fill: '#ff0000',
      appearance: { ...defaultAppearance(), stroke: '#0000ff', strokeWidth: 4, strokeOpacity: 0.3 },
    }),
  ];
  const s = new EditorStore(doc),
    before = structuredClone(s.doc);
  s.selected.add('r');
  new OutlineCommands(s).outline();
  assert.equal(s.current()!.type, 'group');
  assert.equal(s.current()!.opacity, 0.5);
  assert.equal(s.doc.nodes.find((n) => n.id === 'r')!.fill, '#ff0000');
  assert.equal(s.doc.nodes.find((n) => n.name === 'Outlined stroke')!.appearance!.fillOpacity, 0.3);
  s.undo();
  assert.deepEqual(s.doc, before);
});
test('unsupported dashed strokes are rejected without altering the source document', () => {
  assert.throws(
    () =>
      strokeOutline(
        createNode('rectangle', {
          appearance: { ...defaultAppearance(), strokeWidth: 4, strokeStyle: 'dashed' },
        }),
      ),
    /solid/,
  );
});
