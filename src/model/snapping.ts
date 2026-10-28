import type { Box, Point } from './types.ts';
export interface Guide {
  axis: 'x' | 'y';
  position: number;
  from: number;
  to: number;
}
export interface Measurement {
  start: Point;
  end: Point;
  value: number;
}
export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
  measurements: Measurement[];
}
const anchors = (box: Box, axis: 'x' | 'y') =>
  axis === 'x'
    ? [box.x, box.x + box.width / 2, box.x + box.width]
    : [box.y, box.y + box.height / 2, box.y + box.height];
export function measureSpacing(box: Box, candidates: readonly Box[]): Measurement[] {
  const results: Measurement[] = [];
  for (const axis of ['x', 'y'] as const) {
    const position = axis === 'x' ? 'x' : 'y',
      size = axis === 'x' ? 'width' : 'height',
      cross = axis === 'x' ? 'y' : 'x',
      crossSize = axis === 'x' ? 'height' : 'width';
    const aligned = candidates.filter(
      (c) => c[cross] < box[cross] + box[crossSize] && c[cross] + c[crossSize] > box[cross],
    );
    const before = aligned
      .filter((c) => c[position] + c[size] <= box[position])
      .sort((a, b) => b[position] + b[size] - (a[position] + a[size]))[0];
    const after = aligned
      .filter((c) => c[position] >= box[position] + box[size])
      .sort((a, b) => a[position] - b[position])[0];
    for (const [other, leading] of [
      [before, true],
      [after, false],
    ] as const)
      if (other) {
        const a = leading ? other[position] + other[size] : box[position] + box[size],
          b = leading ? box[position] : other[position];
        const middle =
          (Math.max(box[cross], other[cross]) +
            Math.min(box[cross] + box[crossSize], other[cross] + other[crossSize])) /
          2;
        results.push({
          start: axis === 'x' ? { x: a, y: middle } : { x: middle, y: a },
          end: axis === 'x' ? { x: b, y: middle } : { x: middle, y: b },
          value: b - a,
        });
      }
  }
  return results;
}
export function snapTranslation(
  box: Box,
  candidates: readonly Box[],
  dx: number,
  dy: number,
  zoom: number,
  enabled = true,
): SnapResult {
  const moving = { ...box, x: box.x + dx, y: box.y + dy },
    tolerance = 6 / zoom,
    guides: Guide[] = [];
  if (enabled)
    for (const axis of ['x', 'y'] as const) {
      let nearest: { delta: number; target: Box; value: number } | undefined;
      for (const candidate of candidates)
        for (const a of anchors(moving, axis))
          for (const b of anchors(candidate, axis)) {
            const delta = b - a;
            if (
              Math.abs(delta) <= tolerance &&
              (!nearest || Math.abs(delta) < Math.abs(nearest.delta))
            )
              nearest = { delta, target: candidate, value: b };
          }
      // Balance equal gaps between the nearest neighbours when close enough.
      const size = axis === 'x' ? 'width' : 'height',
        cross = axis === 'x' ? 'y' : 'x',
        crossSize = axis === 'x' ? 'height' : 'width';
      const peers = candidates.filter(
        (c) =>
          c[cross] < moving[cross] + moving[crossSize] && c[cross] + c[crossSize] > moving[cross],
      );
      const left = peers
        .filter((c) => c[axis] + c[size] <= moving[axis])
        .sort((a, b) => b[axis] + b[size] - a[axis] - a[size])[0];
      const right = peers
        .filter((c) => c[axis] >= moving[axis] + moving[size])
        .sort((a, b) => a[axis] - b[axis])[0];
      const balance =
        left && right
          ? (left[axis] + left[size] + right[axis] - moving[size]) / 2 - moving[axis]
          : undefined;
      if (
        balance !== undefined &&
        Math.abs(balance) <= tolerance &&
        (!nearest || Math.abs(balance) < Math.abs(nearest.delta))
      ) {
        moving[axis] += balance;
        if (axis === 'x') dx += balance;
        else dy += balance;
      } else if (nearest) {
        moving[axis] += nearest.delta;
        if (axis === 'x') dx += nearest.delta;
        else dy += nearest.delta;
        guides.push({
          axis,
          position: nearest.value,
          from: Math.min(moving[cross], nearest.target[cross]) - 12 / zoom,
          to:
            Math.max(
              moving[cross] + moving[crossSize],
              nearest.target[cross] + nearest.target[crossSize],
            ) +
            12 / zoom,
        });
      }
    }
  return { dx, dy, guides, measurements: measureSpacing(moving, candidates) };
}
export function snapPoint(
  point: Point,
  candidates: readonly Box[],
  zoom: number,
): { point: Point; guides: Guide[] } {
  const result = { ...point },
    guides: Guide[] = [];
  for (const axis of ['x', 'y'] as const) {
    let nearest: { value: number; distance: number; box: Box } | undefined;
    for (const box of candidates)
      for (const value of anchors(box, axis)) {
        const distance = Math.abs(value - point[axis]);
        if (distance <= 6 / zoom && (!nearest || distance < nearest.distance))
          nearest = { value, distance, box };
      }
    if (nearest) {
      result[axis] = nearest.value;
      const cross = axis === 'x' ? 'y' : 'x',
        size = axis === 'x' ? 'height' : 'width';
      guides.push({
        axis,
        position: nearest.value,
        from: Math.min(point[cross], nearest.box[cross]),
        to: Math.max(point[cross], nearest.box[cross] + nearest.box[size]),
      });
    }
  }
  return { point: result, guides };
}
