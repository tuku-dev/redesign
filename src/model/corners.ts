import { cubicPoint } from './bezier.ts';
import type { VectorPoint } from './features.ts';
import type { Point } from './types.ts';
interface Cubic {
  a: Point;
  b: Point;
  c: Point;
  d: Point;
  curved: boolean;
}
export interface CornerInfo {
  /** Unit tangents leaving the anchor along the previous and next segments. */
  u: Point;
  v: Point;
  angle: number;
  tangent: number;
  maxRadius: number;
}
const EPSILON = 1e-9,
  SAMPLES = 48;
const lerp = (p: Point, q: Point, t: number): Point => ({
  x: p.x + (q.x - p.x) * t,
  y: p.y + (q.y - p.y) * t,
});
const unit = (x: number, y: number): Point | null => {
  const length = Math.hypot(x, y);
  return length < EPSILON ? null : { x: x / length, y: y / length };
};
function segment(ring: VectorPoint[], i: number): Cubic {
  const a = ring[i],
    b = ring[(i + 1) % ring.length],
    curved = Boolean(a.out || b.in);
  return curved
    ? { a, b: a.out ?? a, c: b.in ?? b, d: b, curved }
    : { a, b: lerp(a, b, 1 / 3), c: lerp(a, b, 2 / 3), d: b, curved };
}
function lengthAt(s: Cubic): number[] {
  const lengths = [0];
  let previous: Point = s.a;
  for (let i = 1; i <= SAMPLES; i++) {
    const next = cubicPoint(s.a, s.b, s.c, s.d, i / SAMPLES);
    lengths.push(lengths[i - 1] + Math.hypot(next.x - previous.x, next.y - previous.y));
    previous = next;
  }
  return lengths;
}
function paramAtLength(lengths: number[], target: number): number {
  const total = lengths[SAMPLES];
  if (target <= 0) return 0;
  if (target >= total) return 1;
  let i = 1;
  while (lengths[i] < target) i++;
  const span = lengths[i] - lengths[i - 1] || 1;
  return (i - 1 + (target - lengths[i - 1]) / span) / SAMPLES;
}
function splitLeft(s: Cubic, t: number): Cubic {
  const ab = lerp(s.a, s.b, t),
    bc = lerp(s.b, s.c, t),
    cd = lerp(s.c, s.d, t),
    abc = lerp(ab, bc, t),
    bcd = lerp(bc, cd, t);
  return { a: s.a, b: ab, c: abc, d: lerp(abc, bcd, t), curved: s.curved };
}
function splitRight(s: Cubic, t: number): Cubic {
  const ab = lerp(s.a, s.b, t),
    bc = lerp(s.b, s.c, t),
    cd = lerp(s.c, s.d, t),
    abc = lerp(ab, bc, t),
    bcd = lerp(bc, cd, t);
  return { a: lerp(abc, bcd, t), b: bcd, c: cd, d: s.d, curved: s.curved };
}
function sub(s: Cubic, t0: number, t1: number): Cubic {
  const left = splitLeft(s, t1);
  return t1 <= 0 ? left : splitRight(left, t0 / t1);
}
function leaving(p: VectorPoint, handle: Point | undefined, other: Point): Point | null {
  return (handle && unit(handle.x - p.x, handle.y - p.y)) || unit(other.x - p.x, other.y - p.y);
}
/** Describes the corner at ring[i], or null for smooth anchors and degenerate segments. */
export function cornerInfo(ring: VectorPoint[], i: number): CornerInfo | null {
  const count = ring.length;
  if (count < 3) return null;
  const p = ring[i],
    prev = ring[(i + count - 1) % count],
    next = ring[(i + 1) % count],
    u = leaving(p, p.in, prev),
    v = leaving(p, p.out, next);
  if (!u || !v) return null;
  const angle = Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y))),
    tangent = Math.tan(angle / 2);
  if (angle > Math.PI - 0.02 || tangent < 1e-4) return null;
  const before = lengthAt(segment(ring, (i + count - 1) % count)),
    after = lengthAt(segment(ring, i)),
    maxRadius = (Math.min(before[SAMPLES], after[SAMPLES]) / 2) * tangent;
  return { u, v, angle, tangent, maxRadius };
}
/** Replaces corner anchors, including those beside curves, with fillets. */
export function roundRing(ring: VectorPoint[], radius: number): VectorPoint[] {
  const count = ring.length;
  if (count < 3) return ring;
  const infos = ring.map((p, i) => {
    const r = p.radius ?? radius;
    return r > 0 ? cornerInfo(ring, i) : null;
  });
  if (!infos.some(Boolean)) return ring;
  const segments = ring.map((_, i) => segment(ring, i)),
    lengths = segments.map(lengthAt),
    trims = infos.map((info, i) => {
      if (!info) return 0;
      const r = ring[i].radius ?? radius;
      return Math.min(
        r / info.tangent,
        lengths[(i + count - 1) % count][SAMPLES] / 2,
        lengths[i][SAMPLES] / 2,
      );
    }),
    trimmed = segments.map((s, i) => {
      const at = (target: number) =>
          s.curved
            ? paramAtLength(lengths[i], target)
            : Math.max(0, Math.min(1, target / (lengths[i][SAMPLES] || 1))),
        t0 = infos[i] ? at(trims[i]) : 0,
        next = (i + 1) % count,
        t1 = infos[next] ? at(lengths[i][SAMPLES] - trims[next]) : 1;
      return sub(s, t0, Math.max(t0, t1));
    }),
    result: VectorPoint[] = [];
  const direction = (s: Cubic, atEnd: boolean): Point => {
    const first = atEnd ? unit(s.d.x - s.c.x, s.d.y - s.c.y) : unit(s.b.x - s.a.x, s.b.y - s.a.y);
    return first ?? unit(s.d.x - s.a.x, s.d.y - s.a.y) ?? { x: 1, y: 0 };
  };
  ring.forEach((p, i) => {
    const info = infos[i],
      before = trimmed[(i + count - 1) % count],
      after = trimmed[i];
    if (!info) {
      const point: VectorPoint = { ...p };
      delete point.in;
      delete point.out;
      if (before.curved) point.in = before.c;
      if (after.curved) point.out = after.b;
      result.push(point);
      return;
    }
    const handle = (4 / 3) * Math.tan((Math.PI - info.angle) / 4) * trims[i] * info.tangent,
      incoming = direction(before, true),
      outgoing = direction(after, false);
    result.push(
      {
        ...before.d,
        ...(before.curved ? { in: before.c } : {}),
        out: { x: before.d.x + incoming.x * handle, y: before.d.y + incoming.y * handle },
      },
      {
        ...after.a,
        in: { x: after.a.x - outgoing.x * handle, y: after.a.y - outgoing.y * handle },
        ...(after.curved ? { out: after.b } : {}),
      },
    );
  });
  return result;
}
