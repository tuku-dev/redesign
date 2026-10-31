import assert from 'node:assert/strict';
import test from 'node:test';
import { detectContainer, rejectBinaryDocument } from '../src/interop/fig-container.ts';

const bytes = (text: string) => new TextEncoder().encode(text);

test('detects fig-kiwi and zip headers and ignores JSON', () => {
  assert.equal(detectContainer(bytes('fig-kiwi\u0000\u0000')), 'fig-kiwi');
  assert.equal(detectContainer(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0])), 'zip');
  assert.equal(detectContainer(bytes('{"version"')), 'unknown');
  assert.equal(detectContainer(new Uint8Array()), 'unknown');
});

test('binary and .fig files are rejected with a clear message, JSON passes', async () => {
  await assert.rejects(
    rejectBinaryDocument(new File([bytes('fig-kiwi')], 'a.fig')),
    /\.fig files are not supported/,
  );
  await assert.rejects(
    rejectBinaryDocument(new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'a.json')),
    /not supported/,
  );
  await assert.doesNotReject(rejectBinaryDocument(new File([bytes('{}')], 'a.redesign')));
});
