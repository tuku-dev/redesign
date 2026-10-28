import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createNode, validateDocument } from '../src/model/document.ts';
import { History } from '../src/commands/history.ts';
test('documents round trip without losing editable data', () => {
  const doc = createDocument();
  doc.nodes.push(createNode('text', { text: 'Hello नमस्ते\nreDesign', x: -35 }));
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(doc))), doc);
});
test('invalid versions, duplicate IDs, and unsafe geometry are rejected', () => {
  const doc = createDocument();
  doc.nodes.push(createNode('rectangle'));
  assert.throws(() => validateDocument({ ...doc, version: 2 }));
  assert.throws(() => validateDocument({ ...doc, nodes: [doc.nodes[0], doc.nodes[0]] }));
  doc.nodes[0].width = -1;
  assert.throws(() => validateDocument(doc));
});
test('undo and redo preserve snapshots and branching clears redo', () => {
  const h = new History();
  const doc = createDocument();
  h.push(doc);
  doc.nodes.push(createNode('rectangle'));
  const old = h.undo(doc);
  assert.equal(old.nodes.length, 0);
  assert.equal(h.redo(old).nodes.length, 1);
  h.undo(doc);
  h.push(old);
  assert.equal(h.future.length, 0);
});
