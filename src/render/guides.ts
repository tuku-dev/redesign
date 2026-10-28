import type { GestureController } from '../editor/gestures.ts';
import { svg } from './svg.ts';
export function renderGuides(
  overlay: SVGGElement,
  gestures: GestureController,
  zoom: number,
): void {
  const group = svg('g', { 'pointer-events': 'none' }),
    color = '#e8478b';
  for (const guide of gestures.guides) {
    group.append(
      svg('line', {
        x1: guide.axis === 'x' ? guide.position : guide.from,
        y1: guide.axis === 'x' ? guide.from : guide.position,
        x2: guide.axis === 'x' ? guide.position : guide.to,
        y2: guide.axis === 'x' ? guide.to : guide.position,
        stroke: color,
        'stroke-width': 1 / zoom,
      }),
    );
  }
  for (const measurement of gestures.measurements) {
    if (measurement.value < 0.01 || measurement.value > 600 / zoom) continue;
    const { start, end } = measurement,
      mx = (start.x + end.x) / 2,
      my = (start.y + end.y) / 2,
      label = String(Math.round(measurement.value * 10) / 10),
      width = (label.length * 6 + 10) / zoom;
    group.append(
      svg('line', {
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        stroke: color,
        'stroke-width': 1 / zoom,
      }),
    );
    for (const p of [start, end])
      group.append(
        svg('line', {
          x1: p.x - (start.y === end.y ? 0 : 3 / zoom),
          y1: p.y - (start.y === end.y ? 3 / zoom : 0),
          x2: p.x + (start.y === end.y ? 0 : 3 / zoom),
          y2: p.y + (start.y === end.y ? 3 / zoom : 0),
          stroke: color,
          'stroke-width': 1 / zoom,
        }),
      );
    group.append(
      svg('rect', {
        x: mx - width / 2,
        y: my - 8 / zoom,
        width,
        height: 16 / zoom,
        rx: 3 / zoom,
        fill: 'white',
      }),
    );
    const text = svg('text', {
      x: mx,
      y: my + 3.5 / zoom,
      'text-anchor': 'middle',
      'font-size': 10 / zoom,
      'font-family': 'Arial',
      fill: color,
    });
    text.textContent = label;
    group.append(text);
  }
  overlay.append(group);
}
