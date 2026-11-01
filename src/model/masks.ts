import type { DesignDocument, DesignNode, Point } from './types.ts';
import { localPoint, pointInNode } from './rotation.ts';
import { flattenRing, mapVectorPoint } from './bezier.ts';
import { insideRing, roundRing } from './vector.ts';
import { cornerRadii } from './geometry.ts';
export const maskSource = (doc: DesignDocument, node: DesignNode): boolean =>
  doc.nodes.some((n) => n.id === node.parentId && n.maskId === node.id);
export function canMask(n: DesignNode): boolean {
  return (
    n.type === 'rectangle' || n.type === 'ellipse' || (n.type === 'path' && !!n.vector?.closed)
  );
}
export function insideMask(n: DesignNode, p: Point): boolean {
  if (n.hidden || !pointInNode(p, n)) return false;
  const q = localPoint(p, n);
  if (n.type === 'ellipse')
    return (
      ((q.x - n.x - n.width / 2) / (n.width / 2)) ** 2 +
        ((q.y - n.y - n.height / 2) / (n.height / 2)) ** 2 <=
      1
    );
  if (n.vector) {
    const point = q,
      rings = n.vector.rings.map((r) =>
        flattenRing(
          roundRing(
            r.map((p) =>
              mapVectorPoint(p, (v) => ({ x: n.x + v.x * n.width, y: n.y + v.y * n.height })),
            ),
            n.radius,
          ),
          true,
          0.25,
        ),
      );
    if (n.vector.fillRule !== 'nonzero')
      return rings.filter((r) => insideRing(point, r)).length % 2 === 1;
    let winding = 0;
    for (const r of rings)
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length],
          cross = (b.x - a.x) * (point.y - a.y) - (point.x - a.x) * (b.y - a.y);
        if (a.y <= point.y && b.y > point.y && cross > 0) winding++;
        if (a.y > point.y && b.y <= point.y && cross < 0) winding--;
      }
    return winding !== 0;
  }
  const radii = cornerRadii(n),
    tests: [number, number, number][] = [
      [n.x + radii.topLeft, n.y + radii.topLeft, radii.topLeft],
      [n.x + n.width - radii.topRight, n.y + radii.topRight, radii.topRight],
      [n.x + n.width - radii.bottomRight, n.y + n.height - radii.bottomRight, radii.bottomRight],
      [n.x + radii.bottomLeft, n.y + n.height - radii.bottomLeft, radii.bottomLeft],
    ];
  for (let i = 0; i < tests.length; i++) {
    const [x, y, r] = tests[i];
    if (
      r &&
      (i === 0
        ? q.x < x && q.y < y
        : i === 1
          ? q.x > x && q.y < y
          : i === 2
            ? q.x > x && q.y > y
            : q.x < x && q.y > y) &&
      Math.hypot(q.x - x, q.y - y) > r
    )
      return false;
  }
  return true;
}
/** Deleting or reparenting a mask releases its owner rather than leaving dangling references. */
export function reconcileMasks(doc: DesignDocument): void {
  for (const list of [doc.nodes, ...(doc.workspace?.pages.map((p) => p.nodes) ?? [])])
    for (const n of list)
      if (n.maskId && !list.some((c) => c.id === n.maskId && c.parentId === n.id && canMask(c)))
        delete n.maskId;
}
