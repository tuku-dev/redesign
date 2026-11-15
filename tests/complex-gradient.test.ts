import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleGradient } from '../src/render/complex-gradient.ts';

test('angular sampling interpolates colors, preserves transparent stops and pads endpoints', () => {
  const stops = [
    { position: 0.2, color: '#ff0000', opacity: 0 },
    { position: 0.8, color: '#0000ff', opacity: 1 },
  ];
  assert.equal(sampleGradient(stops, 0).opacity, 0);
  assert.equal(sampleGradient(stops, 0.5).color, '#0000ff');
  assert.ok(Math.abs(sampleGradient(stops, 0.5).opacity - 0.5) < 1e-10);
  assert.equal(sampleGradient(stops, 1).opacity, 1);
  assert.deepEqual(
    sampleGradient(
      [
        { position: 0, color: '#ff0000', opacity: 1 },
        { position: 1, color: '#0000ff', opacity: 1 },
      ],
      0.5,
    ),
    { color: '#800080', opacity: 1 },
  );
});

test('coincident angular stops produce a hard transition without invalid interpolation', () => {
  const stops = [
    { position: 0, color: '#ff0000', opacity: 1 },
    { position: 0.5, color: '#ff0000', opacity: 1 },
    { position: 0.5, color: '#0000ff', opacity: 0.5 },
    { position: 1, color: '#0000ff', opacity: 0.5 },
  ];
  assert.equal(sampleGradient(stops, 0.4999).color, '#ff0000');
  assert.equal(sampleGradient(stops, 0.5).color, '#0000ff');
  assert.equal(sampleGradient(stops, 0.5001).opacity, 0.5);
});
