import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorStore } from '../src/editor/store.ts';
import { GestureController } from '../src/editor/gestures.ts';
import { createDocument, createNode, validateDocument } from '../src/model/document.ts';
import { clone } from '../src/model/types.ts';
import { isLocked, isHidden, groupedTarget } from '../src/model/layer-state.ts';
import { hierarchyRows, descendants } from '../src/model/hierarchy.ts';
import { localPoint, pointInNode, transformNodePoint } from '../src/model/rotation.ts';
import { EditingCommands } from '../src/commands/editing.ts';
import { StructureCommands } from '../src/commands/structure.ts';
import { LayerStateCommands } from '../src/commands/layer-state.ts';
import { LayerOrderCommands } from '../src/commands/layer-order.ts';
import { SelectionCommands } from '../src/commands/selection.ts';
import { ClipboardController } from '../src/interop/clipboard-controller.ts';
import { buildContextMenu } from '../src/ui/context-menu-actions.ts';
import type { MenuServices, MenuEntry, MenuSection } from '../src/ui/context-menu-actions.ts';
function setup() {
  const doc = createDocument();
  doc.nodes = [
    createNode('rectangle', { name: 'A', x: 10, y: 20, width: 30, height: 40 }),
    createNode('ellipse', { name: 'B', x: 80, y: 40, width: 20, height: 20 }),
    createNode('rectangle', { name: 'C', x: 150, y: 80, width: 30, height: 30 }),
  ];
  const store = new EditorStore(doc);
  store.selected = new Set(doc.nodes.slice(0, 2).map((n) => n.id));
  const services: MenuServices = {
    store,
    commands: new EditingCommands(store),
    structure: new StructureCommands(store),
    states: new LayerStateCommands(store),
    order: new LayerOrderCommands(store),
    selection: new SelectionCommands(store),
    clipboard: new ClipboardController(store, () => {}),
    fit: () => {},
    rename: () => {},
    exportSelection: () => {},
  };
  return services;
}
function entries(sections: MenuSection[]): MenuEntry[] {
  return sections.flatMap((section) =>
    section.flatMap((entry) => [entry, ...(entry.children ? entries(entry.children) : [])]),
  );
}
test('group selection creates an undoable container without moving artwork; ungroup restores children', () => {
  const s = setup(),
    before = clone(s.store.doc);
  s.structure.wrap('group');
  const group = s.store.current()!;
  assert.equal(group.type, 'group');
  assert.equal(group.x, 10);
  assert.equal(group.width, 90);
  const kids = s.store.doc.nodes.filter((n) => n.parentId === group.id);
  assert.equal(kids.length, 2);
  assert.equal(kids[0].x, 10);
  assert.equal(kids[1].y, 40);
  assert.equal(groupedTarget(s.store.doc, kids[0].id), group.id);
  assert.equal(groupedTarget(s.store.doc, kids[0].id, true), kids[0].id);
  s.structure.unwrap();
  assert.equal(s.store.doc.nodes.length, 3);
  assert.equal(s.store.selected.size, 2);
  assert.ok(s.store.chosen().every((n) => n.parentId === null));
  s.store.undo();
  assert.equal(s.store.current(), undefined);
  assert.equal(s.store.doc.nodes.length, 4);
  s.store.undo();
  assert.deepEqual(s.store.doc, before);
});
test('ungrouping multiple containers lifts each child once and preserves sibling order', () => {
  const s = setup(),
    ids = s.store.doc.nodes.map((n) => n.id);
  s.structure.wrap('group');
  const first = s.store.current()!.id;
  s.store.selected = new Set([ids[2]]);
  s.structure.wrap('group');
  const second = s.store.current()!.id;
  s.store.selected = new Set([first, second]);
  s.structure.unwrap();
  assert.equal(s.store.doc.nodes.length, 3);
  assert.deepEqual(
    s.store.doc.nodes.map((n) => n.id),
    ids,
  );
  validateDocument(s.store.doc);
});
test('frame selection wraps existing nodes and group bounds follow child edits', () => {
  const s = setup();
  s.structure.wrap('frame');
  const frame = s.store.current()!;
  assert.equal(frame.type, 'frame');
  assert.equal(descendants(s.store.doc, s.store.selected).length, 3);
  s.structure.unwrap();
  s.structure.wrap('group');
  const group = s.store.current()!;
  const child = s.store.doc.nodes.find((n) => n.parentId === group.id)!;
  s.store.selected = new Set([child.id]);
  s.commands.nudge(-30, 0);
  assert.equal(s.store.doc.nodes.find((n) => n.id === group.id)?.x, -20);
});
test('locked containers protect descendants from pointer, nudge, deletion and property edits', () => {
  const s = setup();
  s.structure.wrap('group');
  const group = s.store.current()!;
  s.states.toggle('locked');
  const child = s.store.doc.nodes.find((n) => n.parentId === group.id)!;
  assert.equal(isLocked(s.store.doc, child), true);
  s.store.selected = new Set([child.id]);
  const before = clone(s.store.doc);
  s.commands.nudge(10, 10);
  s.commands.setProperty('width', 90);
  s.commands.remove();
  assert.deepEqual(s.store.doc, before);
  const gesture = new GestureController(s.store);
  gesture.startSelection({ x: 10, y: 20 }, child.id, false);
  assert.equal(gesture.active, null);
  gesture.startResize({ x: 10, y: 20 }, 'se');
  assert.equal(gesture.active, null);
  s.states.unlockAll();
  assert.equal(
    isLocked(
      s.store.doc,
      s.store.doc.nodes.find((n) => n.id === child.id)!,
    ),
    false,
  );
});
test('hidden parents hide descendants from all-selection and point hit menus; reveal is undoable', () => {
  const s = setup();
  s.structure.wrap('frame');
  const frame = s.store.current()!,
    child = s.store.doc.nodes.find((n) => n.parentId === frame.id)!;
  s.states.toggle('hidden');
  assert.equal(isHidden(s.store.doc, child), true);
  s.selection.all();
  assert.equal(s.store.selected.size, 1);
  assert.ok(!s.selection.at({ x: 15, y: 25 }).includes(child.id));
  s.states.revealAll();
  assert.equal(
    isHidden(
      s.store.doc,
      s.store.doc.nodes.find((n) => n.id === child.id)!,
    ),
    false,
  );
  s.store.undo();
  assert.equal(s.store.doc.nodes.find((n) => n.id === frame.id)?.hidden, true);
});
test('multiselection order commands preserve relative order and do not move children between parents', () => {
  const s = setup(),
    ids = s.store.doc.nodes.map((n) => n.id);
  s.store.selected = new Set([ids[0], ids[1]]);
  s.order.order('front');
  assert.deepEqual(
    s.store.doc.nodes.map((n) => n.id),
    [ids[2], ids[0], ids[1]],
  );
  s.order.order('back');
  assert.deepEqual(
    s.store.doc.nodes.map((n) => n.id),
    ids,
  );
  s.store.selected = new Set([ids[0]]);
  s.order.order('forward');
  assert.deepEqual(
    s.store.doc.nodes.map((n) => n.id),
    [ids[1], ids[0], ids[2]],
  );
  s.structure.wrap('frame');
  const frame = s.store.current()!,
    child = s.store.doc.nodes.find((n) => n.parentId === frame.id)!;
  s.store.selected = new Set([child.id]);
  s.order.order('front');
  assert.equal(s.store.current()?.parentId, frame.id);
});
test('drag reorder moves selected siblings as a stable block and rejects cross-parent drops', () => {
  const s = setup(),
    [a, b, c] = s.store.doc.nodes;
  assert.ok(a && b && c);
  s.store.selected = new Set([a.id, b.id]);
  assert.equal(s.order.canReorderRelative(s.store.selected, c.id), true);
  s.order.reorderRelative(s.store.selected, c.id, false);
  assert.deepEqual(
    s.store.doc.nodes.map((node) => node.id),
    [c.id, a.id, b.id],
  );
  s.store.undo();
  assert.deepEqual(
    s.store.doc.nodes.map((node) => node.id),
    [a.id, b.id, c.id],
  );

  s.store.selected = new Set([a.id]);
  s.order.reorderRelative(s.store.selected, c.id, true);
  assert.deepEqual(
    s.store.doc.nodes.map((node) => node.id),
    [b.id, a.id, c.id],
  );
  s.store.undo();
  s.store.selected = new Set([a.id]);
  s.structure.wrap('frame');
  const frame = s.store.current()!,
    child = s.store.doc.nodes.find((node) => node.parentId === frame.id)!;
  assert.equal(s.order.canReorderRelative(new Set([child.id]), a.id), false);
});
test('clipboard paste-here anchors the copied subtree bounds at the requested point', () => {
  const s = setup();
  s.structure.wrap('group');
  s.clipboard.nodes = clone(descendants(s.store.doc, s.store.selected));
  s.clipboard.paste(false, { x: 500, y: 300 });
  assert.equal(s.store.current()?.x, 500);
  assert.equal(s.store.current()?.y, 300);
  validateDocument(s.store.doc);
});
test('context menu exposes real selection commands, nested actions and correct disabled states', () => {
  const s = setup(),
    menu = entries(buildContextMenu(s, { x: 15, y: 25 }));
  for (const id of [
    'cut',
    'copy',
    'paste',
    'paste-here',
    'duplicate',
    'group',
    'frame',
    'front',
    'back',
    'lock',
    'hide',
    'export-selection',
    'delete',
  ])
    assert.ok(
      menu.find((item) => item.id === id),
      id,
    );
  assert.equal(menu.find((item) => item.id === 'rename')?.disabled, true);
  assert.equal(menu.find((item) => item.id === 'align-left')?.disabled, undefined);
  assert.equal(menu.find((item) => item.id === 'distribute-x')?.disabled, true);
  assert.equal(menu.find((item) => item.id === 'rotate-flip')?.disabled, false);
  menu.find((item) => item.id === 'group')!.run!();
  assert.equal(s.store.current()?.type, 'group');
  const grouped = entries(buildContextMenu(s, { x: 15, y: 25 }));
  assert.equal(grouped.find((item) => item.id === 'ungroup')?.disabled, false);
  s.states.toggle('locked');
  const locked = entries(buildContextMenu(s, { x: 15, y: 25 }));
  assert.equal(locked.find((item) => item.id === 'delete')?.disabled, true);
  assert.equal(locked.find((item) => item.id === 'lock')?.label, 'Unlock selection');
});
test('rotation and flip menu actions transform the selection and are undoable', () => {
  const s = setup(),
    selectedIds = [...s.store.selected],
    getEntry = (id: string) =>
      entries(buildContextMenu(s, { x: 15, y: 25 })).find((item) => item.id === id)!,
    restoreSelection = () => {
      s.store.selected = new Set(selectedIds);
    },
    [a, b] = s.store.doc.nodes;
  getEntry('rotate-90-cw').run!();
  assert.equal(s.store.doc.nodes[0].rotation, 90);
  assert.equal(s.store.doc.nodes[0].x, 40);
  assert.equal(s.store.doc.nodes[1].rotation, 90);
  assert.equal(s.store.doc.nodes[1].x, 35);
  s.store.undo();
  assert.deepEqual(s.store.doc.nodes.slice(0, 2), [a, b]);
  restoreSelection();
  getEntry('rotate-180').run!();
  assert.equal(s.store.doc.nodes[0].rotation, -180);
  s.store.undo();
  restoreSelection();
  getEntry('rotate-90-ccw').run!();
  assert.equal(s.store.doc.nodes[0].rotation, -90);
  s.store.undo();
  restoreSelection();
  getEntry('flip-horizontal').run!();
  assert.equal(s.store.doc.nodes[0].x, 70);
  assert.equal(s.store.doc.nodes[1].x, 10);
  assert.equal(s.store.doc.nodes[0].flipX, true);
  assert.equal(s.store.doc.nodes[0].rotation, 0);
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(s.store.doc))), s.store.doc);
  s.store.undo();
  restoreSelection();
  getEntry('flip-vertical').run!();
  assert.equal(s.store.doc.nodes[0].y, 20);
  assert.equal(s.store.doc.nodes[1].y, 20);
  assert.equal(s.store.doc.nodes[0].flipY, true);
});
test('flipped rotated geometry supports hit testing and inverse point mapping', () => {
  const node = createNode('rectangle', {
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    rotation: 30,
    flipX: true,
  });
  const local = { x: 18, y: 35 },
    world = transformNodePoint(local, node),
    restored = localPoint(world, node);
  assert.ok(pointInNode(world, node));
  assert.ok(Math.abs(restored.x - local.x) < 1e-8);
  assert.ok(Math.abs(restored.y - local.y) < 1e-8);
});
test('empty-canvas menu excludes object mutations and exposes recovery commands', () => {
  const s = setup();
  s.selection.none();
  const menu = entries(buildContextMenu(s, { x: 600, y: 600 }));
  assert.ok(!menu.some((item) => item.id === 'group' || item.id === 'delete'));
  assert.ok(menu.some((item) => item.id === 'paste-here'));
  assert.ok(menu.some((item) => item.id === 'show-all'));
});
test('group hierarchy and lock/hidden flags persist; invalid flag values are rejected', () => {
  const s = setup();
  s.structure.wrap('group');
  s.states.toggle('locked');
  s.states.toggle('hidden');
  const saved = JSON.parse(JSON.stringify(s.store.doc));
  assert.deepEqual(validateDocument(saved), s.store.doc);
  saved.nodes[0].locked = 'yes';
  assert.throws(() => validateDocument(saved));
  assert.ok(hierarchyRows(s.store.doc).some((row) => row.depth === 1));
});

test('right-clicking selected artwork retains multiselection and containing groups', () => {
  const s = setup(),
    selected = new Set(s.store.selected);
  s.selection.context(s.store.doc.nodes[0].id);
  assert.deepEqual(s.store.selected, selected);
  s.structure.wrap('group');
  const group = s.store.current()!,
    child = s.store.doc.nodes.find((n) => n.parentId === group.id)!;
  s.selection.context(child.id);
  assert.deepEqual([...s.store.selected], [group.id]);
  s.selection.context(child.id, true);
  assert.deepEqual([...s.store.selected], [child.id]);
});
