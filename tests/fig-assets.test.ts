import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { unzipSync, zipSync } from 'fflate';
import { decodeFig } from '../src/interop/fig/decode.ts';
import { importFig } from '../src/interop/fig/import.ts';
import { convertFig } from '../src/interop/fig/convert.ts';
import { readFigPath, readFigNetwork } from '../src/interop/fig/vectors.ts';
import { figImage } from '../src/interop/fig/images.ts';
import { FeatureCommands } from '../src/commands/features.ts';
import { EditorStore } from '../src/editor/store.ts';
import { validateDocument } from '../src/model/document.ts';
import { makeFig } from './fixtures/fig-builder.ts';
const fixture = (name: string) => new Uint8Array(readFileSync('tests/fixtures/fig/' + name));
function network(branch = false): Uint8Array {
  const nv = branch ? 4 : 3,
    ns = branch ? 3 : 2,
    bytes = new Uint8Array(12 + nv * 12 + ns * 28),
    v = new DataView(bytes.buffer);
  v.setUint32(0, nv, true);
  v.setUint32(4, ns, true);
  for (let i = 0; i < nv; i++) {
    v.setFloat32(12 + i * 12 + 4, i * 20, true);
    v.setFloat32(12 + i * 12 + 8, i === 1 ? 40 : 0, true);
  }
  for (let i = 0; i < ns; i++) {
    const p = 12 + nv * 12 + i * 28;
    v.setUint32(p + 4, branch ? 0 : i, true);
    v.setUint32(p + 16, i + 1, true);
    v.setFloat32(p + 8, 10, true);
    v.setFloat32(p + 20, -10, true);
  }
  return bytes;
}
test('native fill curves retain editable controls, winding rule and world geometry after point edits and undo', () => {
  const { document } = importFig(fixture('corners.fig'), 'Test');
  const n = document.nodes.find((n) => n.vector?.rings.some((r) => r.some((p) => p.in || p.out)))!;
  assert.equal(n.vector!.fillRule, 'nonzero');
  const store = new EditorStore(document);
  store.selected.add(n.id);
  const before = structuredClone(store.doc);
  new FeatureCommands(store).vertex(0, 0, { x: -0.1, y: 0.2 });
  assert.equal(store.current()!.vector!.fillRule, 'nonzero');
  store.undo();
  assert.deepEqual(store.doc, before);
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(document))), document);
});
test('simple native stroke networks recover cubic centerlines and reject missing vertex indices', () => {
  const node = { size: { x: 40, y: 40 }, vectorData: { normalizedSize: { x: 40, y: 40 } } },
    bytes = network(),
    rings = readFigNetwork(bytes, node)!;
  assert.equal(rings.length, 1);
  assert.equal(rings[0].closed, false);
  assert.equal(rings[0].points.length, 3);
  assert.deepEqual(rings[0].points[0].out, { x: rings[0].points[0].x - 10, y: 0 });
  assert.equal(readFigNetwork(network(true), node), null);
  new DataView(bytes.buffer).setUint32(12 + 3 * 12 + 16, 99, true);
  assert.throws(() => readFigNetwork(bytes, node), /missing vertex/);
});
test('truncated, non-finite, unknown and oversized native path commands fail instead of partially importing', () => {
  for (const bytes of [
    new Uint8Array([1, 0]),
    new Uint8Array([9]),
    new Uint8Array([2, 0, 0, 0, 0, 0, 0, 0, 0]),
  ])
    assert.throws(() => readFigPath(bytes), /Cannot import/);
  const bytes = new Uint8Array(9);
  bytes[0] = 1;
  new DataView(bytes.buffer).setFloat32(1, Infinity, true);
  assert.throws(() => readFigPath(bytes), /invalid vector coordinate/);
  assert.throws(() => readFigPath(new Uint8Array(10001).fill(1)), /truncated/);
});
test('missing vector blobs fail the full import before editor mutation', () => {
  const decoded = decodeFig(fixture('corners.fig'));
  const nodes = decoded.message.nodeChanges as Record<string, unknown>[];
  const vector = nodes.find((n) => n.type === 'VECTOR')!;
  vector.fillGeometry = [{ commandsBlob: 999, windingRule: 'NONZERO' }];
  assert.throws(() => convertFig(decoded, 'Bad'), /missing vector blob/);
});
test('real embedded PNG and JPEG images keep dimensions, fitting, alpha and image payloads', () => {
  const decoded = decodeFig(fixture('structure.fig'));
  assert.equal(decoded.images.size, 3);
  const node = (decoded.message.nodeChanges as Record<string, unknown>[]).find(
    (n) => n.name === 'sketch 1',
  )!;
  const paints = node.fillPaints as Record<string, unknown>[];
  paints[0].opacity = 0.4;
  paints[0].imageScaleMode = 'FIT';
  const result = convertFig(decoded, 'Test');
  const image = result.document.nodes.find((n) => n.name === 'sketch 1')!.image!;
  assert.equal(image.opacity, 0.4);
  assert.equal(image.fit, 'contain');
  assert.equal(image.naturalWidth, 64);
  assert.equal(image.naturalHeight, 64);
  assert.match(image.src, /^data:image\/png;base64,/);
  assert.ok(result.document.nodes.some((n) => n.image?.src.startsWith('data:image/jpeg;base64,')));
});
test('missing, unsupported and tiled image paints are disclosed without inventing pixels', () => {
  const decoded = decodeFig(fixture('structure.fig')),
    node = (decoded.message.nodeChanges as Record<string, unknown>[]).find(
      (n) => n.name === 'sketch 1',
    )!,
    warnings: string[] = [];
  assert.equal(
    figImage(node, new Map(), (m) => warnings.push(m)),
    null,
  );
  assert.ok(warnings.some((w) => w.includes('missing')));
  (node.fillPaints as Record<string, unknown>[])[0].imageScaleMode = 'TILE';
  assert.equal(
    figImage(node, decoded.images, (m) => warnings.push(m)),
    null,
  );
  assert.ok(warnings.some((w) => w.includes('Tiled')));
});
test('corrupt image entry CRCs and image-size expansion budgets reject the archive', () => {
  const files = unzipSync(fixture('structure.fig')),
    bytes = zipSync(files, { level: 0 }),
    v = new DataView(bytes.buffer);
  let pos = 0;
  while (pos + 46 < bytes.length) {
    if (v.getUint32(pos, true) === 0x02014b50) {
      const len = v.getUint16(pos + 28, true),
        name = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + len));
      if (/^images\/[a-f0-9]{40}$/.test(name)) {
        v.setUint32(pos + 16, v.getUint32(pos + 16, true) ^ 1, true);
        break;
      }
    }
    pos++;
  }
  assert.throws(() => decodeFig(bytes), /checksum/);
  const large = zipSync({
    'canvas.fig': makeFig(undefined, false),
    ['images/' + 'a'.repeat(40)]: new Uint8Array(8 * 1024 * 1024 + 1),
  });
  assert.throws(() => decodeFig(large), /limit/);
});
test('archive asset references are never fetched from external URLs', () => {
  const decoded = decodeFig(fixture('structure.fig'));
  const node = (decoded.message.nodeChanges as Record<string, unknown>[]).find(
    (n) => n.name === 'sketch 1',
  )!;
  (node.fillPaints as Record<string, unknown>[])[0].image = {
    name: 'https://example.invalid/private.png',
  };
  const warnings: string[] = [];
  assert.equal(
    figImage(node, decoded.images, (m) => warnings.push(m)),
    null,
  );
  assert.ok(warnings.length);
});
