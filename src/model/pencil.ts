import type { Point } from './types.ts';
import type { VectorPoint } from './features.ts';

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = dx * dx + dy * dy;
  if (!length) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ramer-Douglas-Peucker reduction; keeps the first and last samples. */
export function simplifyPoints(points: readonly Point[], tolerance: number): Point[] {
  if (points.length < 3) return points.map((p) => ({ ...p }));
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let worst = -1,
      index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = distanceToSegment(points[i], points[first], points[last]);
      if (d > worst) {
        worst = d;
        index = i;
      }
    }
    if (index !== -1 && worst > tolerance) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]).map((p) => ({ ...p }));
}

/** Turns a freehand stroke into a smooth open path with Catmull-Rom style handles. */
export function strokeToVector(samples: readonly Point[], tolerance: number): VectorPoint[] {
  const simple = simplifyPoints(samples, tolerance);
  if (simple.length < 3) return simple;
  return simple.map((p, i) => {
    if (i === 0 || i === simple.length - 1) return p;
    const prev = simple[i - 1],
      next = simple[i + 1],
      tx = (next.x - prev.x) / 6,
      ty = (next.y - prev.y) / 6;
    return {
      ...p,
      in: { x: p.x - tx, y: p.y - ty },
      out: { x: p.x + tx, y: p.y + ty },
      smooth: true,
    };
  });
}
