import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { zstdCompressSync } from 'node:zlib';
import { compileSchema, encodeBinarySchema, parseSchema } from 'kiwi-schema';
import { deflateSync, zipSync, Zip, ZipDeflate } from 'fflate';
import { importFig } from '../src/interop/fig/import.ts';
import { decodeFig } from '../src/interop/fig/decode.ts';
import { convertFig } from '../src/interop/fig/convert.ts';
import { readFigSchema, readFigMessage } from '../src/interop/fig/kiwi.ts';
import { inflateFig } from '../src/interop/fig/compression.ts';
import { validateDocument } from '../src/model/document.ts';
import { EditorStore } from '../src/editor/store.ts';
import { EditingCommands } from '../src/commands/editing.ts';
import {
  basicFigNodes,
  figTestSchema,
  id,
  parent,
  solid,
  transform,
  nativeStream,
  makeFig,
} from './fixtures/fig-builder.ts';

const fixture = (name: string) => new Uint8Array(readFileSync('tests/fixtures/fig/' + name));
test('real version 106 Zstandard fixture imports its editable subset and discloses skipped vectors', () => {
  const { document, report } = importFig(fixture('corners.fig'), 'Corners');
  assert.equal(report.version, 106);
  assert.equal(report.container, 'zip');
  assert.equal(report.imported, 6);
  assert.equal(report.skipped, 4);
  assert.deepEqual(report.skippedTypes, ['VECTOR']);
  assert.equal(report.pages, 1);
  const n = document.nodes.find((n) => n.name === 'rect radius=12, smoothing=none')!;
  assert.equal(n.x, -67);
  assert.equal(n.y, -64);
  assert.equal(n.radius, 12);
  assert.equal(n.width, 100);
  assert.ok(report.warnings.some((w) => w.includes('smoothing')));
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(document))), document);
});
test('real version 48 DEFLATE fixture retains nesting, transformed geometry and internal-page exclusion', () => {
  const { document, report } = importFig(fixture('structure.fig'), 'Structure');
  assert.equal(report.version, 48);
  assert.equal(report.imported, 10);
  assert.equal(report.skipped, 13);
  assert.equal(report.pages, 1);
  const n = document.nodes.find((n) => n.name === 'Group 1')!;
  assert.notEqual(n.rotation, 0);
  assert.notEqual(n.parentId, null);
  assert.ok(report.warnings.some((w) => w.includes('non-solid paints')));
});
test('ZIP and bare streams import identical pages, text, paints, hierarchy and sibling order', () => {
  const bare = importFig(makeFig(undefined, false), 'Test'),
    zip = importFig(makeFig(), 'Test');
  assert.deepEqual(bare.document, zip.document);
  assert.equal(zip.document.nodes[1].x, 110);
  assert.equal(zip.document.nodes[1].y, 70);
  assert.equal(zip.document.nodes[1].appearance?.fillOpacity, 0.5);
  assert.equal(zip.document.nodes[3].text, 'Hello \u4e16\u754c');
  assert.equal(zip.document.nodes[3].fontSize, 14);
  assert.deepEqual(
    zip.document.nodes.map((n) => n.name),
    ['Frame', 'Card', 'Dot', 'Label'],
  );
});
test('imported nodes remain editable and moving a frame carries children with one undo', () => {
  const result = importFig(makeFig(), 'Test');
  const store = new EditorStore(result.document);
  store.selected.add('fig:1:2');
  const before = structuredClone(store.doc);
  const edit = new EditingCommands(store);
  edit.nudge(10, 0);
  assert.equal(store.doc.nodes[1].x, before.nodes[1].x + 10);
  store.undo();
  assert.deepEqual(store.doc, before);
});
test('multiple pages, hidden/locked nodes and rotated parent-local positions survive conversion', () => {
  const nodes: Record<string, unknown>[] = basicFigNodes();
  nodes[2].transform = transform(100, 50, Math.PI / 2);
  nodes[3].locked = true;
  nodes[3].visible = false;
  nodes.push({ guid: id(10), type: 'CANVAS', name: 'Second', parentIndex: parent(0, '"') });
  nodes.push({
    guid: id(11),
    type: 'ELLIPSE',
    parentIndex: parent(10),
    size: { x: 20, y: 30 },
    transform: transform(),
    fillPaints: [solid()],
  });
  const result = importFig(makeFig(nodes), 'Test');
  assert.equal(result.report.pages, 2);
  const n = result.document.nodes[1];
  assert.ok(Math.abs(n.rotation - 90) < 1e-4);
  assert.ok(Math.abs(n.x - 20) < 1e-4);
  assert.ok(Math.abs(n.y - 80) < 1e-4);
  assert.equal(n.locked, true);
  assert.equal(n.hidden, true);
  assert.equal(result.document.workspace!.pages[1].nodes.length, 1);
});
test('unsupported component subtrees are counted instead of detached or flattened', () => {
  const nodes: Record<string, unknown>[] = basicFigNodes();
  nodes[2].type = 'SYMBOL';
  const result = convertFig(
    {
      ...decodeFig(makeFig()),
      message: {
        type: 'NODE_CHANGES',
        nodeChanges: [
          ...nodes,
          {
            guid: id(12),
            type: 'ELLIPSE',
            parentIndex: parent(1),
            size: { x: 30, y: 30 },
            fillPaints: [solid()],
          },
        ],
      },
    },
    'Test',
  );
  assert.equal(result.report.imported, 1);
  assert.equal(result.report.skipped, 4);
  assert.ok(result.report.skippedTypes.includes('SYMBOL'));
  assert.throws(() => importFig(makeFig(nodes), 'Test'), /only unsupported content/);
});
test('malformed framing, extension-spoofed JSON, old versions and corrupt compressed chunks fail clearly', () => {
  for (const input of [
    new Uint8Array(),
    new TextEncoder().encode('{}'),
    makeFig(undefined, false).subarray(0, 19),
    new TextEncoder().encode('fig-kiwi'),
  ])
    assert.throws(() => decodeFig(input), /Cannot import .fig/);
  const data = makeFig(undefined, false);
  new DataView(data.buffer).setUint32(8, 1, true);
  assert.throws(() => decodeFig(data), /older than 15/);
  const overflow = makeFig(undefined, false);
  new DataView(overflow.buffer).setUint32(12, 0xffffffff, true);
  assert.throws(() => decodeFig(overflow), /truncated chunk/);
  assert.throws(() => inflateFig(new Uint8Array([255, 255, 255]), 1024));
});
test('ZIP reader rejects missing canvas, bad checksums, unsafe paths and excessive declared expansion', () => {
  assert.throws(
    () => decodeFig(zipSync({ 'test.txt': new Uint8Array([1]) })),
    /missing a root canvas.fig/,
  );
  const canvas = makeFig(undefined, false),
    bad = zipSync({ 'canvas.fig': canvas }, { level: 0 });
  bad[42] ^= 1;
  assert.throws(() => decodeFig(bad));
  assert.throws(() => decodeFig(zipSync({ '../canvas.fig': canvas })), /unsafe/);
  const huge = makeFig();
  const view = new DataView(huge.buffer);
  let offset = 0;
  while (view.getUint32(offset, true) !== 0x02014b50) offset++;
  view.setUint32(offset + 24, 0x7fffffff, true);
  assert.throws(() => decodeFig(huge), /expansion/);
});
test('bounded decompression rejects bombs and oversized Zstandard window declarations', () => {
  assert.throws(() => inflateFig(deflateSync(new Uint8Array(5000)), 1000), /exceeds/);
  assert.throws(
    () => inflateFig(new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0, 0xf8, 1, 0, 0]), 1024),
    /window/,
  );
  const compressed = new Uint8Array(zstdCompressSync(new Uint8Array(5000)));
  assert.throws(() => inflateFig(compressed, 1000), /exceeds/);
  assert.equal(inflateFig(compressed, 6000).length, 5000);
});
test('Kiwi interpreter matches trusted encoder for strings, byte arrays and 64-bit integers without code generation', () => {
  const input = {
    type: 'NODE_CHANGES',
    nodeChanges: basicFigNodes(),
    testBlob: new Uint8Array([0, 128, 255]),
    label: '\u4e16\u754c \ud83c\udfa8',
    wide: 18446744073709551615n,
  };
  const schema = readFigSchema(encodeBinarySchema(figTestSchema)),
    encoded = compileSchema(figTestSchema).encodeMessage(input);
  const output = readFigMessage(encoded, schema);
  assert.equal(output.label, input.label);
  assert.equal(output.wide, input.wide);
  assert.deepEqual(output.testBlob, input.testBlob);
  assert.throws(() => readFigMessage(encoded.subarray(0, encoded.length - 1), schema), /truncated/);
  assert.throws(() => readFigMessage(new Uint8Array([...encoded, 0]), schema), /trailing/);
});
test('Kiwi schema names, field tags and recursive message depth are bounded', () => {
  const bad = structuredClone(figTestSchema);
  bad.definitions[0].name = '__proto__';
  assert.throws(() => readFigSchema(encodeBinarySchema(bad)), /invalid Kiwi schema/);
  const recursive = parseSchema('message Message { Message nested=1; }');
  const payload = new Uint8Array(400).fill(1);
  assert.throws(() => readFigMessage(payload, recursive), /nesting limit/);
  assert.throws(() => readFigSchema(new Uint8Array([255, 255, 255, 255, 15])), /definition limit/);
});
test('cycles, duplicate GUIDs, dangling parents and incremental records cannot mutate an editor document', () => {
  for (const mutate of [
    (nodes: Record<string, unknown>[]) => {
      nodes.push({ ...nodes[2] });
    },
    (nodes: Record<string, unknown>[]) => {
      nodes[2].parentIndex = parent(3);
    },
    (nodes: Record<string, unknown>[]) => {
      nodes[2].parentIndex = parent(99);
    },
    (nodes: Record<string, unknown>[]) => {
      nodes[2].phase = 'REMOVED';
    },
  ]) {
    const decoded = decodeFig(makeFig()),
      nodes = decoded.message.nodeChanges as Record<string, unknown>[];
    mutate(nodes);
    assert.throws(() => convertFig(decoded, 'Test'), /Cannot import .fig/);
  }
});
test('native chunk framing accepts a Zstandard document alongside a DEFLATE embedded schema', () => {
  const message = compileSchema(figTestSchema).encodeMessage({
    type: 'NODE_CHANGES',
    nodeChanges: basicFigNodes(),
  });
  const bytes = nativeStream(
    deflateSync(encodeBinarySchema(figTestSchema)),
    new Uint8Array(zstdCompressSync(message)),
  );
  assert.equal(importFig(bytes, 'Zstd').report.imported, 4);
});

test('ZIP entries with data descriptors use central-directory sizes', () => {
  const chunks: Uint8Array[] = [];
  const zip = new Zip((error, chunk) => {
    if (error) throw error;
    chunks.push(chunk);
  });
  const canvas = new ZipDeflate('canvas.fig');
  zip.add(canvas);
  canvas.push(makeFig(undefined, false), true);
  zip.end();
  const bytes = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  assert.ok(new DataView(bytes.buffer).getUint16(6, true) & 8);
  assert.equal(importFig(bytes, 'Descriptor').report.imported, 4);
});
