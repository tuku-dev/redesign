import { renderShape } from './shapes.ts';
import type { DesignNode } from '../model/types.ts';
/** Outline masks intentionally ignore paints, raster alpha and effects. */
export function renderMaskShape(node: DesignNode): SVGElement {
  const shape = renderShape({
    ...node,
    appearance: undefined,
    image: undefined,
    fill: '#ffffff',
    opacity: 1,
  });
  shape.removeAttribute('data-id');
  return shape;
}
