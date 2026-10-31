import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createNode, validateDocument } from '../src/model/document.ts';
import { EditorStore } from '../src/editor/store.ts';
import { FeatureCommands } from '../src/commands/features.ts';
import { PageCommands } from '../src/commands/pages.ts';
import { GuideCommands } from '../src/commands/guides.ts';
import { EditingCommands } from '../src/commands/editing.ts';
import { defaultLayout, defaultAppearance, defaultGrid } from '../src/model/features.ts';
import { allNodes } from '../src/model/workspace.ts';
import { booleanRings, insideRing, shapeRings } from '../src/model/vector.ts';
import { PrototypeSession } from '../src/model/prototype.ts';
import { guideCandidates } from '../src/render/layout-grid.ts';
import { cornerRadii, roundedRectPath } from '../src/model/geometry.ts';
import { snapPoint, snapTranslation } from '../src/model/snapping.ts';
import type { DesignNode, Point } from '../src/model/types.ts';
function editor(nodes: DesignNode[]) {
  const doc = createDocument();
  doc.nodes = nodes;
  const s = new EditorStore(doc);
  return { s, c: new FeatureCommands(s), pages: new PageCommands(s), edit: new EditingCommands(s) };
}
function layoutEditor() {
  const f = createNode('frame', { x: 50, y: 100, width: 300, height: 150 }),
    a = createNode('rectangle', { width: 50, height: 20, parentId: f.id }),
    b = createNode('rectangle', { width: 70, height: 30, parentId: f.id });
  return { ...editor([f, a, b]), f: f.id, a: a.id, b: b.id };
}
const node = (s: EditorStore, id: string) => s.doc.nodes.find((n) => n.id === id)!;
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
function area(rings: Point[][]): number {
  return Math.abs(
    rings.reduce(
      (sum, r) =>
        sum +
        r.reduce((s, p, i) => {
          const q = r[(i + 1) % r.length];
          return s + p.x * q.y - q.x * p.y;
        }, 0) /
          2,
      0,
    ),
  );
}
test('toVector converts rectangles and ellipses to editable paths and undoes cleanly', () => {
  const r = createNode('rectangle', { width: 100, height: 50 }),
    e = createNode('ellipse', { width: 80, height: 80 }),
    f = createNode('frame', { width: 200, height: 200 }),
    l = createNode('rectangle', { width: 10, height: 10, locked: true }),
    { s, c } = editor([r, e, f, l]);
  assert.equal(c.toVector(r.id), true);
  assert.equal(node(s, r.id).type, 'path');
  assert.equal(node(s, r.id).vector?.rings[0].length, 4);
  assert.equal(c.toVector(e.id), true);
  assert.equal(node(s, e.id).vector?.rings[0].length, 4);
  assert.equal(c.toVector(r.id), false);
  assert.equal(c.toVector(f.id), false);
  assert.equal(c.toVector(l.id), false);
  s.undo();
  assert.equal(node(s, e.id).type, 'ellipse');
  assert.equal(node(s, e.id).vector, undefined);
});
test('horizontal hug auto layout applies independent padding, gap and one undo transaction', () => {
  const { s, c, f, a, b } = layoutEditor(),
    before = structuredClone(s.doc);
  s.selected = new Set([f]);
  const layout = defaultLayout();
  layout.gap = 10;
  layout.padding = { top: 5, right: 8, bottom: 6, left: 7 };
  c.layout(layout);
  assert.equal(node(s, f).width, 145);
  assert.equal(node(s, f).height, 41);
  assert.equal(node(s, a).x, 57);
  assert.equal(node(s, a).y, 105);
  assert.equal(node(s, b).x, 117);
  s.undo();
  assert.deepEqual(s.doc, before);
  s.redo();
  assert.equal(node(s, f).layout?.gap, 10);
});
test('vertical auto layout distributes fill space, cross alignment and hidden children', () => {
  const { s, c, f, a, b } = layoutEditor();
  s.selected = new Set([f]);
  s.change(() => {
    node(s, f).sizing = { width: 'fixed', height: 'fixed' };
    node(s, b).sizing = { width: 'fill', height: 'fill' };
  });
  const layout = defaultLayout();
  layout.direction = 'vertical';
  layout.gap = 10;
  layout.align = 'end';
  c.layout(layout);
  assert.equal(node(s, a).x, 50 + 300 - 16 - 50);
  assert.equal(node(s, b).width, 268);
  assert.equal(node(s, b).height, 88);
  assert.equal(node(s, b).y, 146);
  s.change(() => {
    node(s, a).hidden = true;
  });
  assert.equal(node(s, b).height, 118);
  assert.equal(node(s, b).y, 116);
});
test('space-between positions first and last items without changing fixed geometry', () => {
  const { s, c, f, a, b } = layoutEditor();
  s.selected = new Set([f]);
  s.change(() => {
    node(s, f).sizing = { width: 'fixed', height: 'fixed' };
  });
  const l = defaultLayout();
  l.justify = 'space-between';
  c.layout(l);
  assert.equal(node(s, a).x, 66);
  assert.equal(node(s, b).x, 264);
});
test('nested layout moves descendants and responds to changing child dimensions', () => {
  const { s, c, f, a } = layoutEditor();
  const nested = createNode('frame', { parentId: f, width: 100, height: 70 }),
    inside = createNode('rectangle', { parentId: nested.id, width: 10, height: 10 });
  s.change(() => s.doc.nodes.push(nested, inside));
  s.selected = new Set([nested.id]);
  c.layout(defaultLayout());
  s.selected = new Set([f]);
  c.layout(defaultLayout());
  near(node(s, inside.id).x, node(s, nested.id).x + 16);
  near(node(s, inside.id).y, node(s, nested.id).y + 16);
  s.selected = new Set([a]);
  new EditingCommands(s).setProperty('width', 100);
  assert.equal(node(s, f).width, 100 + 70 + 42 + 32 + 32);
});
test('auto layout wrapping is undoable and locked selections remain unchanged', () => {
  const a = createNode('rectangle'),
    b = createNode('ellipse', { x: 200 }),
    { s, c } = editor([a, b]);
  s.selected = new Set([a.id, b.id]);
  const before = structuredClone(s.doc);
  c.addLayout();
  assert.equal(s.current()?.type, 'frame');
  s.undo();
  assert.deepEqual(s.doc, before);
  s.doc.nodes[0].locked = true;
  const locked = structuredClone(s.doc);
  c.addLayout();
  assert.deepEqual(s.doc, locked);
});
test('creating a component from loose layers is one undo step', () => {
  const n = createNode('rectangle'),
    { s, c } = editor([n]);
  s.selected = new Set([n.id]);
  const before = structuredClone(s.doc);
  c.createComponent();
  assert.equal(s.current()?.component?.kind, 'main');
  s.undo();
  assert.deepEqual(s.doc, before);
});
function componentEditor() {
  const frame = createNode('frame', { x: 10, y: 20 }),
    child = createNode('text', { x: 20, y: 30, parentId: frame.id, text: 'Original' }),
    e = editor([frame, child]);
  e.s.selected = new Set([frame.id]);
  e.c.createComponent();
  e.c.instantiate();
  const root = e.s.current()!,
    copy = e.s.doc.nodes.find((n) => n.parentId === root.id)!;
  return { ...e, main: frame.id, source: child.id, instance: root.id, copy: copy.id };
}
test('main component text and fill updates propagate while instance placement is preserved', () => {
  const { s, edit, main, source, instance, copy } = componentEditor();
  const x = node(s, instance).x,
    y = node(s, instance).y;
  s.selected = new Set([source]);
  edit.setText('Updated');
  edit.setProperty('fill', '#ff0000');
  assert.equal(node(s, copy).text, 'Updated');
  assert.equal(node(s, copy).fill, '#ff0000');
  s.selected = new Set([main]);
  edit.nudge(30, 40);
  assert.equal(node(s, instance).x, x);
  assert.equal(node(s, instance).y, y);
  near(node(s, copy).x, x + 10);
});
test('instance overrides survive main edits and reset restores inherited content', () => {
  const { s, c, edit, source, instance, copy } = componentEditor();
  s.selected = new Set([copy]);
  edit.setText('Override');
  s.selected = new Set([source]);
  edit.setText('New source');
  assert.equal(node(s, copy).text, 'Override');
  s.selected = new Set([instance]);
  c.resetInstance();
  assert.equal(node(s, copy).text, 'New source');
  s.undo();
  assert.equal(node(s, copy).text, 'Override');
});
test('new and deleted source children reconcile with instances without duplicate IDs', () => {
  const { s, main, instance, source, copy } = componentEditor();
  const newChild = createNode('ellipse', { parentId: main, x: 30, y: 40 });
  s.change(() => s.doc.nodes.push(newChild));
  assert.equal(s.doc.nodes.filter((n) => n.parentId === instance).length, 2);
  s.selected = new Set([source]);
  new EditingCommands(s).remove();
  assert.ok(!s.doc.nodes.some((n) => n.id === copy));
  assert.equal(new Set(s.doc.nodes.map((n) => n.id)).size, s.doc.nodes.length);
});
test('detached instances stop inheriting and removing a main safely detaches its instances', () => {
  const { s, c, edit, main, instance, source, copy } = componentEditor();
  s.selected = new Set([instance]);
  c.detach();
  s.selected = new Set([source]);
  edit.setText('Changed');
  assert.equal(node(s, copy).text, 'Original');
  assert.equal(node(s, instance).component, undefined);
  s.selected = new Set([main]);
  c.instantiate();
  const id = s.current()!.id;
  s.selected = new Set([main]);
  edit.remove();
  assert.equal(node(s, id).component, undefined);
});
test('components can be inserted from another page and remain linked', () => {
  const { s, c, pages, main, source } = componentEditor();
  pages.add();
  c.instantiate(main);
  const copy = s.doc.nodes.find((n) => n.instanceSource === source)!;
  assert.ok(copy);
  pages.switch('page-1');
  s.selected = new Set([source]);
  new EditingCommands(s).setText('Across pages');
  assert.equal(allNodes(s.doc).find((n) => n.id === copy.id)?.text, 'Across pages');
});
test('page switching, renaming, reordering and deletion preserve layers with undo', () => {
  const a = createNode('rectangle'),
    { s, pages } = editor([a]);
  pages.add();
  const id = s.doc.workspace!.activePageId;
  pages.rename('Second');
  pages.reorder(-1);
  assert.equal(s.doc.workspace!.pages[0].name, 'Second');
  pages.switch('page-1');
  assert.equal(s.doc.nodes[0].id, a.id);
  pages.switch(id);
  assert.equal(s.doc.nodes.length, 0);
  pages.remove();
  assert.equal(s.doc.nodes[0].id, a.id);
  s.undo();
  assert.equal(s.doc.workspace!.activePageId, id);
  assert.throws(() => new PageCommands(new EditorStore()).remove());
});
test('page duplication remaps hierarchy, component links and prototype targets without moving layers', () => {
  const { s, c, pages, main, source } = componentEditor();
  s.selected = new Set([source]);
  c.prototype(main, 'instant', 0);
  const old = structuredClone(s.doc.nodes);
  pages.duplicate();
  assert.equal(s.doc.nodes.length, old.length);
  assert.equal(s.doc.nodes[0].x, old[0].x);
  assert.equal(s.doc.nodes[0].y, old[0].y);
  const copiedMain = s.doc.nodes.find((n) => n.component?.kind === 'main')!,
    instance = s.doc.nodes.find((n) => n.component?.kind === 'instance')!;
  assert.equal(instance.component?.sourceId, copiedMain.id);
  assert.ok(s.doc.nodes.every((n) => !old.some((o) => o.id === n.id)));
  assert.equal(s.doc.nodes.find((n) => n.prototype)?.prototype?.targetId, copiedMain.id);
  assert.doesNotThrow(() => validateDocument(s.doc));
});
test('all new document data round trips and legacy single-page documents still load', () => {
  const { s, c, f } = layoutEditor();
  s.selected = new Set([f]);
  c.layout(defaultLayout());
  c.grid(defaultGrid());
  const a = defaultAppearance();
  a.gradient.enabled = true;
  a.shadow.enabled = true;
  c.appearance(a);
  new GuideCommands(s).add('x', 120);
  new PageCommands(s).add();
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(s.doc))), s.doc);
  assert.equal(validateDocument(createDocument()).workspace, undefined);
});
test('malformed imported features and unsafe images are rejected', () => {
  const n = createNode('rectangle'),
    base = { ...createDocument(), nodes: [n] };
  for (const props of [
    { image: { src: 'javascript:alert(1)', fit: 'cover', focalX: 0.5, focalY: 0.5 } },
    { appearance: { ...defaultAppearance(), blur: NaN } },
    { layout: { ...defaultLayout(), gap: -1 } },
    { vector: { rings: [], closed: true } },
    { layoutGrid: { ...defaultGrid(), count: 1e9 } },
    { prototype: { targetId: 'x', transition: 'script', duration: 1 } },
  ])
    assert.throws(() => validateDocument({ ...base, nodes: [{ ...n, ...props }] }));
});
test('invalid page IDs, duplicate global layer IDs and unsafe guide positions are rejected', () => {
  const { s, pages } = editor([createNode('rectangle')]);
  pages.add();
  const doc = structuredClone(s.doc);
  doc.nodes = [structuredClone(doc.workspace!.pages[0].nodes[0])];
  assert.throws(() => validateDocument(doc));
  const broken = structuredClone(s.doc);
  broken.workspace!.activePageId = 'missing';
  assert.throws(() => validateDocument(broken));
  const invalid = structuredClone(s.doc);
  invalid.workspace!.guides.push({ id: 'g', axis: 'x', position: Infinity });
  assert.throws(() => validateDocument(invalid));
});
test('guide creation, movement, visibility and removal are undoable', () => {
  const s = new EditorStore(),
    g = new GuideCommands(s),
    id = g.add('x', 100);
  g.move(id, 120);
  assert.equal(s.doc.workspace?.guides[0].position, 120);
  s.undo();
  assert.equal(s.doc.workspace?.guides[0].position, 100);
  g.toggle();
  assert.equal(guideCandidates(s.doc).length, 0);
  g.toggle();
  g.remove(id);
  assert.equal(s.doc.workspace?.guides.length, 0);
  s.undo();
  assert.equal(s.doc.workspace?.guides.length, 1);
});
test('guides snap only on their own axis without phantom origins or spacing measurements', () => {
  const s = new EditorStore();
  new GuideCommands(s).add('x', 100);
  const candidates = guideCandidates(s.doc),
    point = snapPoint({ x: 98, y: 3 }, candidates, 1);
  assert.deepEqual(point.point, { x: 100, y: 3 });
  const result = snapTranslation({ x: 80, y: 3, width: 10, height: 10 }, candidates, 8, 0, 1);
  assert.equal(result.dx, 10);
  assert.equal(result.dy, 0);
  assert.equal(result.measurements.length, 0);
});
test('image fills, crop settings and appearance edits are undoable and lock protected', () => {
  const n = createNode('rectangle'),
    { s, c } = editor([n]);
  s.selected = new Set([n.id]);
  const image = {
    src: 'data:image/png;base64,AAAA',
    fit: 'cover' as const,
    focalX: 0.2,
    focalY: 0.8,
    naturalWidth: 200,
    naturalHeight: 100,
  };
  c.image(image);
  assert.deepEqual(s.current()?.image, image);
  s.undo();
  assert.equal(node(s, n.id).image, undefined);
  s.redo();
  s.selected = new Set([n.id]);
  const adjustments = { brightness: 125, contrast: 80, saturation: 0 };
  c.imageAdjustments(adjustments);
  assert.deepEqual(s.current()?.image?.adjustments, adjustments);
  s.undo();
  assert.equal(node(s, n.id).image?.adjustments, undefined);
  s.redo();
  s.selected = new Set([n.id]);
  assert.throws(() => c.imageAdjustments({ ...adjustments, brightness: 201 }), /between 0 and 200/);
  c.imageAdjustments(adjustments);
  assert.deepEqual(s.current()?.image?.adjustments, adjustments);
  const invalid = structuredClone(s.doc);
  invalid.nodes[0].image!.adjustments!.brightness = 201;
  assert.throws(() => validateDocument(invalid));
  node(s, n.id).locked = true;
  const before = structuredClone(s.doc);
  c.appearance(defaultAppearance());
  assert.deepEqual(s.doc, before);
});
test('pen paths preserve normalized geometry and point edits support undo', () => {
  const { s, c } = editor([]);
  c.path(
    [
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 120 },
    ],
    true,
  );
  const n = s.current()!;
  assert.equal(n.type, 'path');
  assert.equal(n.width, 100);
  assert.deepEqual(n.vector?.rings[0][2], { x: 1, y: 1 });
  c.vertex(0, 2, { x: 0.5, y: 1 });
  assert.equal(s.current()?.vector?.rings[0][2].x, 0.5);
  s.undo();
  assert.equal(node(s, n.id).vector?.rings[0][2].x, 1);
});
for (const [operation, expected] of [
  ['union', 150],
  ['intersection', 50],
  ['difference', 50],
  ['xor', 100],
] as const)
  test(`boolean ${operation} calculates actual editable geometry and undo restores originals`, () => {
    const a = createNode('rectangle', { x: 0, y: 0, width: 10, height: 10 }),
      b = createNode('rectangle', { x: 5, y: 0, width: 10, height: 10 }),
      { s, c } = editor([a, b]);
    near(area(booleanRings([a, b], operation)), expected);
    s.selected = new Set([a.id, b.id]);
    const before = structuredClone(s.doc);
    c.boolean(operation);
    assert.equal(s.doc.nodes.length, 1);
    assert.equal(s.current()?.type, 'path');
    s.undo();
    assert.deepEqual(s.doc, before);
  });
test('subtraction holes remain holes in chained boolean operations', () => {
  const outer = createNode('rectangle', { width: 100, height: 100 }),
    inner = createNode('rectangle', { x: 20, y: 20, width: 60, height: 60 }),
    { s, c } = editor([outer, inner]);
  s.selected = new Set([outer.id, inner.id]);
  c.boolean('difference');
  const hole = s.current()!,
    rings = shapeRings(hole);
  assert.equal(rings.length, 2);
  assert.equal(rings.filter((r) => insideRing({ x: 50, y: 50 }, r)).length, 2);
  const small = createNode('rectangle', { x: 30, y: 30, width: 10, height: 10 });
  assert.equal(booleanRings([hole, small], 'intersection').length, 0);
});
test('empty boolean intersections remove operands in one undoable transaction', () => {
  const a = createNode('rectangle', { width: 10, height: 10 }),
    b = createNode('rectangle', { x: 100, width: 10, height: 10 }),
    { s, c } = editor([a, b]);
  s.selected = new Set([a.id, b.id]);
  c.boolean('intersection');
  assert.equal(s.doc.nodes.length, 0);
  s.undo();
  assert.equal(s.doc.nodes.length, 2);
});
test('open paths and locked layers cannot be combined', () => {
  const { s, c } = editor([]);
  c.path(
    [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ],
    false,
  );
  const first = s.current()!,
    other = createNode('rectangle');
  s.change(() => s.doc.nodes.push(other));
  s.selected = new Set([first.id, other.id]);
  assert.throws(() => c.boolean('union'));
  first.locked = true;
  assert.throws(() => c.boolean('union'));
});
test('prototype sessions navigate nested hotspots, cross-page screens, back and restart without mutation', () => {
  const a = createNode('frame', { name: 'A' }),
    b = createNode('frame', { name: 'B', x: 300 }),
    hotspot = createNode('rectangle', {
      parentId: a.id,
      prototype: { targetId: b.id, transition: 'dissolve', duration: 200 },
    }),
    child = createNode('ellipse', { parentId: a.id }),
    { s, pages } = editor([a, b, hotspot, child]);
  pages.add();
  const c = createNode('frame', { name: 'C' });
  s.change(() => s.doc.nodes.push(c));
  const original = structuredClone(s.doc);
  const session = new PrototypeSession(s.doc, a.id);
  assert.equal(session.scene().nodes.length, 3);
  const action = session.activate(hotspot.id);
  assert.equal(action?.transition, 'dissolve');
  assert.equal(session.currentId, b.id);
  session.back();
  assert.equal(session.currentId, a.id);
  session.activate(hotspot.id);
  session.restart();
  assert.equal(session.currentId, a.id);
  assert.deepEqual(s.doc, original);
});
test('invalid prototype destinations fail without corrupting navigation history', () => {
  const a = createNode('frame'),
    link = createNode('rectangle', {
      parentId: a.id,
      prototype: { targetId: 'missing', transition: 'instant', duration: 0 },
    }),
    doc = { ...createDocument(), nodes: [a, link] },
    session = new PrototypeSession(doc, a.id);
  assert.throws(() => session.activate(link.id));
  assert.equal(session.currentId, a.id);
  assert.equal(session.canGoBack, false);
  assert.throws(() => new PrototypeSession(doc, link.id));
});
import { rotatePoint, center } from '../src/model/rotation.ts';
import { documentVisualBounds } from '../src/model/render-bounds.ts';
test('auto layout remains stable across unrelated commits and frame resize distributes fill sizes', () => {
  const { s, c, edit, f, a, b } = layoutEditor();
  s.selected = new Set([f]);
  s.change(() => {
    node(s, f).sizing = { width: 'fixed', height: 'fixed' };
    node(s, a).sizing = { width: 'fill', height: 'fixed' };
    node(s, b).sizing = { width: 'fill', height: 'fixed' };
  });
  c.layout(defaultLayout());
  edit.setProperty('width', 400);
  near(node(s, a).width, 176);
  near(node(s, b).width, 176);
  const before = structuredClone(s.doc);
  s.change(() => {});
  assert.deepEqual(s.doc, before);
});
test('rotated auto layout positions children in the parent frame axes', () => {
  const { s, c, f, a } = layoutEditor();
  s.selected = new Set([f]);
  s.change(() => {
    node(s, f).rotation = 90;
  });
  c.layout(defaultLayout());
  const frame = node(s, f),
    child = node(s, a);
  const local = rotatePoint(center(child), center(frame), -90);
  near(local.x, frame.x + 16 + child.width / 2);
  near(local.y, frame.y + 16 + child.height / 2);
});
test('auto layout changes to main components reach instance geometry in the same transaction', () => {
  const { s, c, main, source, instance, copy } = componentEditor();
  s.selected = new Set([main]);
  c.layout(defaultLayout());
  s.selected = new Set([source]);
  new EditingCommands(s).setProperty('width', 240);
  near(node(s, instance).width, node(s, main).width);
  near(node(s, copy).width, 240);
});
test('vector points moved outside the layer box are reboxed without losing world position', () => {
  const { s, c } = editor([]);
  c.path(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    true,
  );
  const id = s.current()!.id;
  s.change(() => {
    node(s, id).rotation = 30;
  });
  const old = structuredClone(node(s, id)),
    expected = rotatePoint({ x: old.x + old.width * 1.5, y: old.y + old.height }, center(old), 30);
  c.vertex(0, 2, { x: 1.5, y: 1 });
  const result = node(s, id),
    p = result.vector!.rings[0][2],
    actual = rotatePoint(
      { x: result.x + p.x * result.width, y: result.y + p.y * result.height },
      center(result),
      30,
    );
  near(actual.x, expected.x);
  near(actual.y, expected.y);
  assert.equal(result.width, 150);
  assert.equal(result.rotation, 30);
});
test('effect bounds include strokes and shadows, while parent frame clipping still applies', () => {
  const a = defaultAppearance();
  a.strokeWidth = 4;
  a.shadow.enabled = true;
  a.shadow.x = 20;
  a.shadow.blur = 10;
  const n = createNode('rectangle', { width: 100, height: 100, appearance: a }),
    doc = { ...createDocument(), nodes: [n] },
    box = documentVisualBounds(doc)!;
  assert.ok(box.x < 0);
  assert.ok(box.width > 140);
  const f = createNode('frame', { width: 100, height: 100 });
  n.parentId = f.id;
  doc.nodes.unshift(f);
  assert.deepEqual(documentVisualBounds(doc), { x: 0, y: 0, width: 100, height: 100 });
});
test('ellipse booleans use bounded polygon approximations and preserve rotated geometry', () => {
  const e = createNode('ellipse', { width: 100, height: 100, rotation: 35 }),
    r = createNode('rectangle', { x: -100, y: -100, width: 400, height: 400 });
  const rings = booleanRings([e, r], 'intersection');
  assert.ok(Math.abs(area(rings) - Math.PI * 2500) < 20);
});
test('individual corner radii render, persist and return to a uniform radius', () => {
  const shape = createNode('rectangle', { width: 100, height: 40, radius: 8 }),
    { s, edit } = editor([shape]);
  s.selected = new Set([shape.id]);
  edit.setProperty('topLeftRadius', 24);
  assert.deepEqual(cornerRadii(node(s, shape.id)), {
    topLeft: 24,
    topRight: 8,
    bottomRight: 8,
    bottomLeft: 8,
  });
  assert.match(roundedRectPath(node(s, shape.id)), /A 24 24 0 0 1/);
  assert.equal(validateDocument(s.doc).nodes[0].cornerRadii?.topLeft, 24);
  edit.setProperty('radius', 12);
  assert.equal(node(s, shape.id).radius, 12);
  assert.equal(node(s, shape.id).cornerRadii, undefined);
  assert.throws(() =>
    validateDocument({
      ...createDocument(),
      nodes: [
        { ...shape, cornerRadii: { topLeft: -1, topRight: 0, bottomRight: 0, bottomLeft: 0 } },
      ],
    }),
  );
});
test('individual corner radii propagate from component frames to instances', () => {
  const frame = createNode('frame'),
    { s, c, edit } = editor([frame]);
  s.selected = new Set([frame.id]);
  c.createComponent();
  c.instantiate();
  const instanceId = s.current()!.id;
  s.selected = new Set([frame.id]);
  edit.setProperty('topLeftRadius', 16);
  assert.equal(node(s, instanceId).cornerRadii?.topLeft, 16);
});
