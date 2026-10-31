import { rotatePoint, center, normalizeAngle } from '../model/rotation.ts';
import type { DesignDocument, DesignNode, Point } from '../model/types.ts';
export function rotateNodes(
  doc: DesignDocument,
  originals: readonly DesignNode[],
  pivot: Point,
  degrees: number,
): void {
  const starts = new Map(originals.map((n) => [n.id, n]));
  doc.nodes = doc.nodes.map((n) => {
    const old = starts.get(n.id);
    if (!old) return n;
    const c = rotatePoint(center(old), pivot, degrees);
    return {
      ...n,
      x: c.x - old.width / 2,
      y: c.y - old.height / 2,
      rotation: normalizeAngle(old.rotation + degrees),
    };
  });
}
export function flipNodes(
  doc: DesignDocument,
  originals: readonly DesignNode[],
  pivot: Point,
  axis: 'horizontal' | 'vertical',
): void {
  const starts = new Map(originals.map((n) => [n.id, n]));
  doc.nodes = doc.nodes.map((n) => {
    const old = starts.get(n.id);
    if (!old) return n;
    const c = center(old);
    return {
      ...n,
      x: (axis === 'horizontal' ? 2 * pivot.x - c.x : c.x) - old.width / 2,
      y: (axis === 'vertical' ? 2 * pivot.y - c.y : c.y) - old.height / 2,
      rotation: normalizeAngle(-old.rotation),
      flipX: axis === 'horizontal' ? !old.flipX : old.flipX,
      flipY: axis === 'vertical' ? !old.flipY : old.flipY,
    };
  });
}
