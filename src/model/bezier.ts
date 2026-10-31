import type { Point, Box } from './types.ts';
import type { VectorPoint } from './features.ts';
export function mapVectorPoint(p: VectorPoint, map: (point: Point) => Point): VectorPoint {
  return {
    ...p,
    ...map(p),
    ...(p.in ? { in: map(p.in) } : {}),
    ...(p.out ? { out: map(p.out) } : {}),
  };
}
export function cubicPoint(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}
export function segments(ring: VectorPoint[], closed: boolean): [VectorPoint, VectorPoint][] {
  const result: [VectorPoint, VectorPoint][] = [];
  for (let i = 1; i < ring.length; i++) result.push([ring[i - 1], ring[i]]);
  if (closed && ring.length > 1) result.push([ring.at(-1)!, ring[0]]);
  return result;
}
/** Shared by draft, canvas and export, including the curved closing segment. */
export function bezierPathData(rings: VectorPoint[][], closed: boolean): string {
  return rings
    .map((r) => {
      if (!r.length) return '';
      const commands = [`M ${r[0].x} ${r[0].y}`];
      for (const [a, b] of segments(r, closed)) {
        if (a.out || b.in) {
          const c = a.out ?? a,
            d = b.in ?? b;
          commands.push(`C ${c.x} ${c.y} ${d.x} ${d.y} ${b.x} ${b.y}`);
        } else if (b !== r[0]) commands.push(`L ${b.x} ${b.y}`);
      }
      if (closed) commands.push('Z');
      return commands.join(' ');
    })
    .join(' ');
}
function extrema(a: number, b: number, c: number, d: number): number[] {
  const A = -a + 3 * b - 3 * c + d,
    B = 2 * (a - 2 * b + c),
    C = b - a;
  if (Math.abs(A) < 1e-12) return Math.abs(B) < 1e-12 ? [] : [-C / B].filter((t) => t > 0 && t < 1);
  const discriminant = B * B - 4 * A * C;
  if (discriminant < 0) return [];
  const r = Math.sqrt(discriminant);
  return [(-B + r) / (2 * A), (-B - r) / (2 * A)].filter((t) => t > 0 && t < 1);
}
/** Exact cubic extrema keep exports and selection bounds from clipping curved segments. */
export function bezierBounds(rings: VectorPoint[][], closed: boolean): Box {
  const points: Point[] = rings.flat().map((p) => ({ x: p.x, y: p.y }));
  if (points.length < 2) throw new Error('A path needs at least two points.');
  for (const ring of rings)
    for (const [a, d] of segments(ring, closed)) {
      if (!a.out && !d.in) continue;
      const b = a.out ?? a,
        c = d.in ?? d;
      for (const t of [...extrema(a.x, b.x, c.x, d.x), ...extrema(a.y, b.y, c.y, d.y)])
        points.push(cubicPoint(a, b, c, d, t));
    }
  let x = Infinity,
    y = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const p of points) {
    x = Math.min(x, p.x);
    y = Math.min(y, p.y);
    right = Math.max(right, p.x);
    bottom = Math.max(bottom, p.y);
  }
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
/** Adaptive flattening is used only for polygon boolean operations, never SVG paint. */
export function flattenRing(ring: VectorPoint[], closed: boolean, tolerance = 0.25): Point[] {
  const result: Point[] = ring.length ? [{ x: ring[0].x, y: ring[0].y }] : [];
  function split(a: Point, b: Point, c: Point, d: Point, depth: number): void {
    if (
      depth >= 12 ||
      Math.max(distanceToSegment(b, a, d), distanceToSegment(c, a, d)) <= tolerance
    ) {
      result.push({ x: d.x, y: d.y });
      return;
    }
    const ab = midpoint(a, b),
      bc = midpoint(b, c),
      cd = midpoint(c, d),
      abc = midpoint(ab, bc),
      bcd = midpoint(bc, cd),
      m = midpoint(abc, bcd);
    split(a, ab, abc, m, depth + 1);
    split(m, bcd, cd, d, depth + 1);
  }
  for (const [a, b] of segments(ring, closed)) {
    if (a.out || b.in) split(a, a.out ?? a, b.in ?? b, b, 0);
    else result.push({ x: b.x, y: b.y });
    if (result.length > 20000) throw new Error('This path is too complex for a boolean operation.');
  }
  if (closed) result.pop();
  return result;
}
export function moveAnchor(p: VectorPoint, to: Point): void {
  const dx = to.x - p.x,
    dy = to.y - p.y;
  if (p.in) {
    p.in.x += dx;
    p.in.y += dy;
  }
  if (p.out) {
    p.out.x += dx;
    p.out.y += dy;
  }
  p.x = to.x;
  p.y = to.y;
}
export function moveHandle(
  p: VectorPoint,
  side: 'in' | 'out',
  to: Point,
  independent = false,
  scale: Point = { x: 1, y: 1 },
): void {
  p[side] = { ...to };
  if (independent) p.smooth = false;
  if (p.smooth) {
    const other = side === 'in' ? 'out' : 'in',
      old = p[other],
      length = old
        ? Math.hypot((old.x - p.x) * scale.x, (old.y - p.y) * scale.y)
        : Math.hypot((to.x - p.x) * scale.x, (to.y - p.y) * scale.y),
      dx = (to.x - p.x) * scale.x,
      dy = (to.y - p.y) * scale.y,
      d = Math.hypot(dx, dy);
    if (d > 1e-12)
      p[other] = { x: p.x - ((dx / d) * length) / scale.x, y: p.y - ((dy / d) * length) / scale.y };
  }
}
export function pointKind(
  ring: VectorPoint[],
  index: number,
  smooth: boolean,
  closed: boolean,
): void {
  const p = ring[index];
  if (!p) throw new Error('Unknown vector point.');
  if (!smooth) {
    delete p.in;
    delete p.out;
    p.smooth = false;
    return;
  }
  const prev = ring[index - 1] ?? (closed ? ring.at(-1) : undefined),
    next = ring[index + 1] ?? (closed ? ring[0] : undefined);
  const dx = (next?.x ?? p.x) - (prev?.x ?? p.x),
    dy = (next?.y ?? p.y) - (prev?.y ?? p.y),
    length = Math.hypot(dx, dy) || 1;
  const before = prev
    ? Math.hypot(p.x - prev.x, p.y - prev.y) / 3
    : next
      ? Math.hypot(next.x - p.x, next.y - p.y) / 3
      : 20;
  const after = next ? Math.hypot(next.x - p.x, next.y - p.y) / 3 : before;
  p.in = { x: p.x - (dx / length) * before, y: p.y - (dy / length) * before };
  p.out = { x: p.x + (dx / length) * after, y: p.y + (dy / length) * after };
  p.smooth = true;
}
