import type { GradientPaint, GradientStop } from '../model/features.ts';
import { svg } from './svg.ts';

/** Interpolate premultiplied sRGB so transparent stops do not introduce dark fringes. */
export function sampleGradient(
  stops: GradientStop[],
  position: number,
): { color: string; opacity: number } {
  let left = stops[0]!;
  if (position < left.position) return left;
  for (const right of stops.slice(1)) {
    if (position < right.position) {
      const t = (position - left.position) / (right.position - left.position);
      const opacity = left.opacity * (1 - t) + right.opacity * t;
      const color = [1, 3, 5]
        .map((start) => {
          const a = parseInt(left.color.slice(start, start + 2), 16);
          const b = parseInt(right.color.slice(start, start + 2), 16);
          const channel = opacity
            ? (a * left.opacity * (1 - t) + b * right.opacity * t) / opacity
            : 0;
          return Math.round(channel).toString(16).padStart(2, '0');
        })
        .join('');
      return { color: `#${color}`, opacity };
    }
    left = right;
  }
  return left;
}

/** Portable SVG paint servers: angular uses vector sectors; diamond uses four linear gradients. */
export function complexGradient(
  paint: GradientPaint,
  id: string,
  padX: number,
  padY: number,
): SVGPatternElement {
  const pattern = svg('pattern', {
    id,
    'data-gradient-type': paint.type,
    patternUnits: 'objectBoundingBox',
    patternContentUnits: 'objectBoundingBox',
    // Adjacent sectors/quadrants share edges. Disable edge antialiasing here
    // so opaque gradients do not acquire transparent hairlines between them.
    'shape-rendering': 'crispEdges',
    x: -padX,
    y: -padY,
    width: 1 + 2 * padX,
    height: 1 + 2 * padY,
  });
  const center = paint.start;
  const corners = [
    { x: -padX, y: -padY },
    { x: 1 + padX, y: -padY },
    { x: 1 + padX, y: 1 + padY },
    { x: -padX, y: 1 + padY },
  ];
  if (paint.type === 'angular') {
    const radius = Math.max(...corners.map((p) => Math.hypot(p.x - center.x, p.y - center.y))) + 1;
    const angle = Math.atan2(paint.end.y - center.y, paint.end.x - center.x);
    const positions = [...new Set([0, ...paint.stops.map((stop) => stop.position), 1])];
    for (let index = 1; index < positions.length; index++) {
      const from = positions[index - 1]!,
        to = positions[index]!;
      const steps = Math.max(1, Math.ceil((to - from) * 512));
      for (let step = 0; step < steps; step++) {
        const a = from + ((to - from) * step) / steps;
        const b = from + ((to - from) * (step + 1)) / steps;
        const start = angle + a * Math.PI * 2,
          end = angle + b * Math.PI * 2;
        const sample = sampleGradient(paint.stops, (a + b) / 2);
        pattern.append(
          svg('path', {
            d: `M${center.x} ${center.y}L${center.x + Math.cos(start) * radius} ${center.y + Math.sin(start) * radius}A${radius} ${radius} 0 0 1 ${center.x + Math.cos(end) * radius} ${center.y + Math.sin(end) * radius}Z`,
            fill: sample.color,
            'fill-opacity': sample.opacity,
          }),
        );
      }
    }
    return pattern;
  }
  let ux = paint.end.x - center.x,
    uy = paint.end.y - center.y;
  if (Math.hypot(ux, uy) < 1e-6) {
    ux = 1e-6;
    uy = 0;
  }
  let vx = paint.radius ? paint.radius.x - center.x : -uy;
  let vy = paint.radius ? paint.radius.y - center.y : ux;
  if (Math.abs(ux * vy - uy * vx) < 1e-12) {
    vx = -uy;
    vy = ux;
  }
  const determinant = ux * vy - uy * vx;
  const extent =
    1 +
    Math.max(
      ...corners.flatMap((point) => {
        const x = point.x - center.x,
          y = point.y - center.y;
        return [
          Math.abs((x * vy - y * vx) / determinant),
          Math.abs((ux * y - uy * x) / determinant),
        ];
      }),
    );
  for (const [index, [signU, signV]] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ].entries()) {
    const gradientId = `${id}-quadrant-${index}`;
    const gx = (signU! * vy - signV! * uy) / determinant;
    const gy = (signV! * ux - signU! * vx) / determinant;
    const lengthSquared = gx * gx + gy * gy;
    const gradient = svg('linearGradient', {
      id: gradientId,
      gradientUnits: 'userSpaceOnUse',
      x1: center.x,
      y1: center.y,
      x2: center.x + gx / lengthSquared,
      y2: center.y + gy / lengthSquared,
    });
    gradient.append(
      ...paint.stops.map((stop) =>
        svg('stop', {
          offset: stop.position,
          'stop-color': stop.color,
          'stop-opacity': stop.opacity,
        }),
      ),
    );
    const ax = ux * signU! * extent,
      ay = uy * signU! * extent;
    const bx = vx * signV! * extent,
      by = vy * signV! * extent;
    pattern.append(
      gradient,
      svg('path', {
        d: `M${center.x} ${center.y}l${ax} ${ay}l${bx} ${by}l${-ax} ${-ay}Z`,
        fill: `url(#${gradientId})`,
      }),
    );
  }
  return pattern;
}
