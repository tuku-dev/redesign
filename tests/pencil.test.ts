import test from 'node:test';
import assert from 'node:assert/strict';
import { simplifyPoints, strokeToVector } from '../src/model/pencil.ts';

test('simplifyPoints collapses collinear samples and keeps corners', () => {
  const line = Array.from({ length: 10 }, (_, i) => ({ x: i * 10, y: 0 }));
  assert.equal(simplifyPoints(line, 1).length, 2);
  const corner = [...line, { x: 90, y: 10 }, { x: 90, y: 20 }, { x: 90, y: 30 }];
  const simple = simplifyPoints(corner, 1);
  assert.deepEqual(simple.at(0), { x: 0, y: 0 });
  assert.deepEqual(simple.at(-1), { x: 90, y: 30 });
  assert.ok(simple.some((p) => p.x === 90 && p.y === 0));
});

test('strokeToVector smooths interior points and leaves the ends as anchors', () => {
  const wave = Array.from({ length: 30 }, (_, i) => ({ x: i * 5, y: Math.sin(i / 3) * 40 }));
  const points = strokeToVector(wave, 2);
  assert.ok(points.length > 3 && points.length < wave.length);
  assert.equal(points[0]!.out, undefined);
  assert.ok(points[1]!.in && points[1]!.out && points[1]!.smooth);
  assert.equal(
    strokeToVector(
      [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
      2,
    ).length,
    2,
  );
});
