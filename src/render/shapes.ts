import { pathData } from '../model/vector.ts';
import { paintShape } from './paint.ts';
import type { DesignNode } from '../model/types.ts';
import { svg } from './svg.ts';
import { renderText } from './text.ts';
import { nodeTransform } from '../model/rotation.ts';
import { roundedRectPath } from '../model/geometry.ts';
export function renderShape(n: DesignNode): SVGElement {
  const attrs = { fill: n.fill, opacity: n.opacity, 'data-id': n.id };
  let shape: SVGElement;
  if (n.type === 'group')
    shape = svg('rect', {
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      fill: 'transparent',
      'data-id': n.id,
    });
  else if (n.type === 'ellipse')
    shape = svg('ellipse', {
      ...attrs,
      cx: n.x + n.width / 2,
      cy: n.y + n.height / 2,
      rx: n.width / 2,
      ry: n.height / 2,
    });
  else if (n.type === 'path')
    shape = svg('path', {
      ...attrs,
      fill: n.vector?.closed ? n.fill : 'none',
      d: pathData(n),
      'fill-rule': 'evenodd',
    });
  else if (n.type === 'text') shape = renderText(n, attrs);
  else if (n.cornerRadii)
    shape = svg('path', {
      ...attrs,
      d: roundedRectPath(n),
    });
  else
    shape = svg('rect', {
      ...attrs,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      rx: n.radius,
    });
  shape = paintShape(shape, n);
  const transform = nodeTransform(n);
  if (transform) shape.setAttribute('transform', transform);
  return shape;
}
