import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenDocuments, isPristine } from '../src/storage/open-documents.ts';
import { createDocument, createNode } from '../src/model/document.ts';

const empty = { past: [], future: [] };
const named = (name: string) => ({ ...createDocument(), name });

test('a blank untitled document is pristine; renamed or populated ones are not', () => {
  assert.equal(isPristine(createDocument()), true);
  assert.equal(isPristine(named('Work')), false);
  assert.equal(isPristine({ ...createDocument(), nodes: [createNode('rectangle')] }), false);
});

test('adding documents keeps each state and per-document undo history', () => {
  const first = named('First');
  const registry = new OpenDocuments(first);
  const history = { past: [named('First before')], future: [] };
  const added = registry.add(named('Second'), first, history, 'handle-1');
  assert.equal(added.doc.name, 'Second');
  assert.equal(registry.count, 2);
  const back = registry.switchTo(registry.list('Second')[0]!.id, added.doc, empty, null)!;
  assert.equal(back.doc.name, 'First');
  assert.equal(back.history.past[0]!.name, 'First before');
  assert.equal(back.handle, 'handle-1');
});

test('switching to the active or an unknown document does nothing', () => {
  const registry = new OpenDocuments(createDocument());
  assert.equal(registry.switchTo(registry.active, createDocument(), empty, null), null);
  assert.equal(registry.switchTo('missing', createDocument(), empty, null), null);
});

test('closing the active document activates a neighbour and the last close leaves a blank document', () => {
  const a = named('A');
  const registry = new OpenDocuments(a);
  const b = registry.add(named('B'), a, empty, null);
  const next = registry.close(registry.active, b.doc, empty, null)!;
  assert.equal(next.doc.name, 'A');
  assert.equal(registry.count, 1);
  const blank = registry.close(registry.active, next.doc, empty, null)!;
  assert.equal(blank.doc.name, 'Untitled');
  assert.equal(registry.count, 1);
});

test('closing an inactive document leaves the active one untouched', () => {
  const a = named('A');
  const registry = new OpenDocuments(a);
  registry.add(named('B'), a, empty, null);
  const inactive = registry.list('B').find((d) => !d.active)!;
  assert.equal(registry.close(inactive.id, named('B'), empty, null), null);
  assert.equal(registry.count, 1);
});

test('the registry caps open documents', () => {
  const registry = new OpenDocuments(createDocument());
  let current = createDocument();
  while (!registry.full) current = registry.add(createDocument(), current, empty, null).doc;
  assert.throws(() => registry.add(createDocument(), current, empty, null), /limit/);
});

test('serialization round trips and rejects malformed storage safely', () => {
  const a = named('A');
  const registry = new OpenDocuments(a);
  registry.add(named('B'), a, empty, null);
  const live = named('B edited');
  const restored = OpenDocuments.restore(registry.serialize(live), live);
  assert.deepEqual(
    restored.list('B edited').map((d) => d.name),
    ['A', 'B edited'],
  );
  for (const bad of [
    '{',
    '{"activeId":1}',
    '{"activeId":"x","documents":[{"id":"y","doc":{}}]}',
    null,
  ]) {
    const fallback = OpenDocuments.restore(bad, live);
    assert.equal(fallback.count, 1);
  }
});
