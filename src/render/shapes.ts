import type { DesignNode } from '../model/types.ts';
import { svg } from './svg.ts';
import { renderText } from './text.ts';
import { center } from '../model/rotation.ts';
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
  else if (n.type === 'text') shape = renderText(n, attrs);
  else
    shape = svg('rect', {
      ...attrs,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      rx: n.radius,
    });
  const c = center(n);
  if (n.rotation) shape.setAttribute('transform', `rotate(${n.rotation} ${c.x} ${c.y})`);
  return shape;
}
