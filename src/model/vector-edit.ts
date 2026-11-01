import { cubicPoint } from './bezier.ts';
import type { VectorPath, VectorPoint } from './features.ts';
import type { Point } from './types.ts';
const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
/** de Casteljau subdivision preserves the cubic exactly, including a closing segment. */
export function insertVectorPoint(
  path: VectorPath,
  ringIndex: number,
  segment: number,
  t = 0.5,
): number {
  const ring = path.rings[ringIndex];
  if (
    !ring ||
    !Number.isInteger(segment) ||
    segment < 0 ||
    segment >= ring.length - (path.closed ? 0 : 1) ||
    !Number.isFinite(t) ||
    t <= 0 ||
    t >= 1
  )
    throw Error('Choose a valid path segment and an interior position.');
  if (ring.length >= 10000) throw Error('The path point limit has been reached.');
  const a = ring[segment],
    b = ring[(segment + 1) % ring.length];
  let point: VectorPoint;
  if (a.out || b.in) {
    const q0 = lerp(a, a.out ?? a, t),
      q1 = lerp(a.out ?? a, b.in ?? b, t),
      q2 = lerp(b.in ?? b, b, t),
      r0 = lerp(q0, q1, t),
      r1 = lerp(q1, q2, t);
    a.out = q0;
    b.in = q2;
    point = { ...lerp(r0, r1, t), in: r0, out: r1, smooth: true, radius: 0 };
  } else point = { ...lerp(a, b, t), radius: 0 };
  ring.splice(segment + 1, 0, point);
  return segment + 1;
}
export function deleteVectorPoint(path: VectorPath, ringIndex: number, index: number): void {
  const ring = path.rings[ringIndex];
  if (!ring || !Number.isInteger(index) || !ring[index]) throw Error('Choose a valid anchor.');
  if (ring.length <= 2) {
    if (path.rings.length <= 1) throw Error('A path needs at least two anchors.');
    path.rings.splice(ringIndex, 1);
    return;
  }
  ring.splice(index, 1);
  if (!path.closed) {
    delete ring[0].in;
    delete ring.at(-1)!.out;
  }
}
/** Nearest parameter in display units, refined after a coarse sample search. */
export function segmentParameter(
  a: VectorPoint,
  b: VectorPoint,
  p: Point,
  scale: Point = { x: 1, y: 1 },
): number {
  const distance = (t: number) => {
    const q = cubicPoint(a, a.out ?? a, b.in ?? b, b, t);
    return ((p.x - q.x) * scale.x) ** 2 + ((p.y - q.y) * scale.y) ** 2;
  };
  let best = 0.5,
    value = Infinity;
  for (let i = 0; i <= 32; i++) {
    const t = i / 32,
      d = distance(t);
    if (d < value) {
      best = t;
      value = d;
    }
  }
  let lo = Math.max(0, best - 1 / 32),
    hi = Math.min(1, best + 1 / 32);
  for (let i = 0; i < 24; i++) {
    const a = lo + (hi - lo) / 3,
      b = hi - (hi - lo) / 3;
    if (distance(a) < distance(b)) hi = b;
    else lo = a;
  }
  return Math.max(0.001, Math.min(0.999, (lo + hi) / 2));
}
