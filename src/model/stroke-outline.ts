import clipping from 'polygon-clipping';
import type { MultiPolygon, Pair } from 'polygon-clipping';
import { flattenRing, mapVectorPoint } from './bezier.ts';
import { roundRing, shapeRings } from './vector.ts';
import { transformNodePoint } from './rotation.ts';
import type { DesignNode, Point } from './types.ts';
/** Round-cap/round-join solid strokes, polygonized with the editor's curve tolerance. */
export function strokeOutline(node: DesignNode): Point[][] {
  const width = node.appearance?.strokeWidth ?? 0;
  if (width <= 0 || !Number.isFinite(width)) throw Error('Choose a shape with a visible stroke.');
  if (node.appearance?.strokeStyle && node.appearance.strokeStyle !== 'solid')
    throw Error('Outline currently supports solid strokes.');
  if (node.type === 'text' || node.type === 'frame' || node.type === 'group')
    throw Error('Choose a rectangle, ellipse or vector path.');
  let rings: Point[][];
  const closed = node.type !== 'path' || !!node.vector?.closed;
  if (node.vector) {
    rings = node.vector.rings.map((r) => {
      const points = r.map((p) =>
        mapVectorPoint(p, (q) => ({ x: node.x + q.x * node.width, y: node.y + q.y * node.height })),
      );
      return flattenRing(
        (closed ? roundRing(points, node.radius) : points).map((p) =>
          mapVectorPoint(p, (q) => transformNodePoint(q, node)),
        ),
        closed,
        0.25,
      );
    });
  } else rings = shapeRings(node);
  if (rings.reduce((sum, r) => sum + r.length, 0) > 2000)
    throw Error('This stroke is too complex to outline; simplify it first.');
  const radius = width / 2,
    parts: MultiPolygon[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i],
        circle: Pair[] = Array.from({ length: 32 }, (_, j) => [
          p.x + Math.cos((j * Math.PI) / 16) * radius,
          p.y + Math.sin((j * Math.PI) / 16) * radius,
        ]);
      circle.push(circle[0]);
      parts.push([[circle]]);
      if (!closed && i === ring.length - 1) continue;
      const q = ring[(i + 1) % ring.length],
        len = Math.hypot(q.x - p.x, q.y - p.y);
      if (len < 1e-9) continue;
      const x = ((q.y - p.y) / len) * radius,
        y = (-(q.x - p.x) / len) * radius,
        quad: Pair[] = [
          [p.x + x, p.y + y],
          [q.x + x, q.y + y],
          [q.x - x, q.y - y],
          [p.x - x, p.y - y],
        ];
      quad.push(quad[0]);
      parts.push([[quad]]);
    }
  }
  if (!parts.length) throw Error('The stroke has no segments.');
  // Quantize generated arc vertices to avoid near-identical sweep events at tangencies.
  const stable = parts.map((poly) =>
    poly.map((rings) =>
      rings.map((ring) =>
        ring.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6] as Pair),
      ),
    ),
  );
  return clipping
    .union(stable[0], ...stable.slice(1))
    .flatMap((poly) => poly.map((r) => r.slice(0, -1).map(([x, y]) => ({ x, y }))));
}
