import assert from 'node:assert/strict';
import test from 'node:test';
import { detectContainer, isFigDocument } from '../src/interop/fig-container.ts';
const bytes = (text: string) => new TextEncoder().encode(text);
test('detects fig-kiwi and zip headers and ignores JSON', () => {
  assert.equal(detectContainer(bytes('fig-kiwi\u0000\u0000')), 'fig-kiwi');
  assert.equal(detectContainer(new Uint8Array([0x50, 0x4b, 3, 4, 0])), 'zip');
  assert.equal(detectContainer(bytes('{"version"')), 'unknown');
  assert.equal(detectContainer(new Uint8Array()), 'unknown');
});
test('native documents are routed by bytes or extension, while JSON stays on its own path', async () => {
  assert.equal(await isFigDocument(new File([bytes('fig-kiwi')], 'a.bin')), true);
  assert.equal(await isFigDocument(new File([bytes('{}')], 'a.FIG')), true);
  assert.equal(await isFigDocument(new File([new Uint8Array([80, 75, 3, 4])], 'a.json')), true);
  assert.equal(await isFigDocument(new File([bytes('{}')], 'a.redesign')), false);
});
