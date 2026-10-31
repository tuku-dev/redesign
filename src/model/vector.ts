import { bezierPathData, bezierBounds, mapVectorPoint, flattenRing } from './bezier.ts';
import type { VectorPoint } from './features.ts';
import clipping from 'polygon-clipping';
import type { MultiPolygon, Ring } from 'polygon-clipping';
import type { DesignNode, Point } from './types.ts';
import { center, rotatePoint, transformNodePoint } from './rotation.ts';
import { cornerInfo, roundRing } from './corners.ts';
export { roundRing };
function baseRings(n: DesignNode): VectorPoint[][] {
  return n.vector!.rings.map((r) =>
    r.map((p) => mapVectorPoint(p, (q) => ({ x: n.x + q.x * n.width, y: n.y + q.y * n.height }))),
  );
}
function worldRings(n: DesignNode): VectorPoint[][] {
  const rings = baseRings(n);
  return n.vector!.closed ? rings.map((r) => roundRing(r, n.radius)) : rings;
}
export interface VectorCorner {
  ring: number;
  index: number;
  point: Point;
  /** Unit vector pointing into the shape along the corner bisector. */
  direction: Point;
  sinHalf: number;
  radius: number;
  maxRadius: number;
}
/** Sharp corners of closed shapes (in unrotated layer space) that can receive a radius. */
export function vectorCorners(n: DesignNode): VectorCorner[] {
  if (!n.vector?.closed) return [];
  const rings = baseRings(n),
    flat = rings.map((r) => flattenRing(r, true)),
    result: VectorCorner[] = [];
  rings.forEach((ring, r) => {
    const count = ring.length;
    if (count < 3) return;
    ring.forEach((p, index) => {
      const info = cornerInfo(ring, index);
      if (!info) return;
      let dx = info.u.x + info.v.x,
        dy = info.u.y + info.v.y;
      const length = Math.hypot(dx, dy);
      if (length < 1e-9) return;
      dx /= length;
      dy /= length;
      const probe = { x: p.x + dx * 1e-3, y: p.y + dy * 1e-3 };
      if (flat.filter((other) => insideRing(probe, other)).length % 2 === 0) {
        dx = -dx;
        dy = -dy;
      }
      result.push({
        ring: r,
        index,
        point: { x: p.x, y: p.y },
        direction: { x: dx, y: dy },
        sinHalf: Math.sin(info.angle / 2),
        radius: Math.min(p.radius ?? n.radius, info.maxRadius),
        maxRadius: info.maxRadius,
      });
    });
  });
  return result;
}
export function pathData(n: DesignNode): string {
  return n.vector ? bezierPathData(worldRings(n), n.vector.closed) : '';
}
/** Absolute SVG path data of the curve a text layer follows. */
export function textPathData(n: DesignNode): string {
  const path = n.textPath;
  if (!path) return '';
  const rings = path.rings.map((r) =>
    r.map((p) => mapVectorPoint(p, (q) => ({ x: n.x + q.x * n.width, y: n.y + q.y * n.height }))),
  );
  return bezierPathData(rings, path.closed);
}
export function vectorFromPoints(
  rings: VectorPoint[][],
  closed = true,
): Pick<DesignNode, 'x' | 'y' | 'width' | 'height' | 'vector'> {
  const box = bezierBounds(rings, closed);
  return {
    ...box,
    vector: {
      closed,
      rings: rings.map((r) =>
        r.map((p) =>
          mapVectorPoint(p, (q) => ({
            x: (q.x - box.x) / box.width,
            y: (q.y - box.y) / box.height,
          })),
        ),
      ),
    },
  };
}
export function insideRing(p: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
export function shapeRings(n: DesignNode): Point[][] {
  let rings: Point[][];
  if (n.type === 'path' && n.vector?.closed) rings = worldRings(n).map((r) => flattenRing(r, true));
  else if (n.type === 'ellipse')
    rings = [
      Array.from({ length: 64 }, (_, i) => ({
        x: n.x + n.width / 2 + (Math.cos((i * Math.PI) / 32) * n.width) / 2,
        y: n.y + n.height / 2 + (Math.sin((i * Math.PI) / 32) * n.height) / 2,
      })),
    ];
  else if (n.type === 'rectangle') {
    const r = Math.min(n.radius, n.width / 2, n.height / 2);
    if (!r)
      rings = [
        [
          { x: n.x, y: n.y },
          { x: n.x + n.width, y: n.y },
          { x: n.x + n.width, y: n.y + n.height },
          { x: n.x, y: n.y + n.height },
        ],
      ];
    else
      rings = [
        Array.from({ length: 36 }, (_, i) => {
          const corner = Math.floor(i / 9),
            angle = ((-90 + corner * 90 + ((i % 9) * 90) / 8) * Math.PI) / 180;
          const cx = n.x + (corner === 0 || corner === 1 ? n.width - r : r),
            cy = n.y + (corner === 0 || corner === 3 ? r : n.height - r);
          return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
        }),
      ];
  } else throw new Error('Boolean operations require closed paths, rectangles or ellipses.');
  return rings.map((r) => r.map((p) => transformNodePoint(p, n)));
}
function polygons(rings: Point[][]): MultiPolygon {
  const depth = rings.map(
    (r, i) => rings.filter((other, j) => j !== i && insideRing(r[0], other)).length,
  );
  const result: MultiPolygon = [];
  rings.forEach((ring, i) => {
    if (depth[i] % 2) return;
    const holes = rings.filter((r, j) => depth[j] === depth[i] + 1 && insideRing(r[0], ring));
    const convert = (r: Point[]): Ring => [...r, r[0]].map((p) => [p.x, p.y]);
    result.push([convert(ring), ...holes.map(convert)]);
  });
  return result;
}
export type BooleanOperation = 'union' | 'intersection' | 'difference' | 'xor';
export function booleanRings(nodes: DesignNode[], operation: BooleanOperation): Point[][] {
  if (nodes.length < 2) throw new Error('Select at least two closed shapes.');
  const geometries = nodes.map((n) => polygons(shapeRings(n)));
  const result = clipping[operation](geometries[0], ...geometries.slice(1));
  return result.flatMap((p) => p.map((r) => r.slice(0, -1).map(([x, y]) => ({ x, y }))));
}
/** Rebox edited vertices while retaining their world positions and the layer rotation. */
export function normalizeVector(n: DesignNode): void {
  if (!n.vector) return;
  const local = n.vector.rings.map((r) =>
    r.map((p) => mapVectorPoint(p, (q) => ({ x: n.x + q.x * n.width, y: n.y + q.y * n.height }))),
  );
  const next = vectorFromPoints(local, n.vector.closed);
  if (
    Math.max(
      Math.abs(next.x - n.x),
      Math.abs(next.y - n.y),
      Math.abs(next.width - n.width),
      Math.abs(next.height - n.height),
    ) < 1e-8
  )
    return;
  const newCenter = rotatePoint(center(next), center(n), n.rotation);
  Object.assign(n, next, { x: newCenter.x - next.width / 2, y: newCenter.y - next.height / 2 });
}
