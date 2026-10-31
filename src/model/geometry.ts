import type { Box, CornerRadii, DesignNode, Point } from './types.ts';
export function bounds(nodes: readonly Box[]): Box | null {
  if (!nodes.length) return null;
  const x = Math.min(...nodes.map((n) => n.x)),
    y = Math.min(...nodes.map((n) => n.y));
  return {
    x,
    y,
    width: Math.max(...nodes.map((n) => n.x + n.width)) - x,
    height: Math.max(...nodes.map((n) => n.y + n.height)) - y,
  };
}
export function fitView(
  box: Box | null,
  width: number,
  height: number,
  padding = 64,
): { zoom: number; pan: Point } | null {
  if (!box || width <= 0 || height <= 0) return null;
  const zoom = Math.max(
    0.1,
    Math.min(
      8,
      Math.max(1, width - 2 * padding) / box.width,
      Math.max(1, height - 2 * padding) / box.height,
    ),
  );
  return {
    zoom,
    pan: {
      x: width / 2 - (box.x + box.width / 2) * zoom,
      y: height / 2 - (box.y + box.height / 2) * zoom,
    },
  };
}
export function cornerRadii(node: Pick<DesignNode, 'radius' | 'cornerRadii'>): CornerRadii {
  return (
    node.cornerRadii ?? {
      topLeft: node.radius,
      topRight: node.radius,
      bottomRight: node.radius,
      bottomLeft: node.radius,
    }
  );
}
export function roundedRectPath(
  node: Pick<DesignNode, 'x' | 'y' | 'width' | 'height' | 'radius' | 'cornerRadii'>,
): string {
  const radii = cornerRadii(node),
    scale = Math.min(
      1,
      node.width / Math.max(1, radii.topLeft + radii.topRight),
      node.width / Math.max(1, radii.bottomLeft + radii.bottomRight),
      node.height / Math.max(1, radii.topLeft + radii.bottomLeft),
      node.height / Math.max(1, radii.topRight + radii.bottomRight),
    ),
    tl = radii.topLeft * scale,
    tr = radii.topRight * scale,
    br = radii.bottomRight * scale,
    bl = radii.bottomLeft * scale,
    { x, y, width, height } = node;
  const arc = (radius: number, endX: number, endY: number) =>
    radius ? `A ${radius} ${radius} 0 0 1 ${endX} ${endY}` : `L ${endX} ${endY}`;
  return [
    `M ${x + tl} ${y}`,
    `L ${x + width - tr} ${y}`,
    arc(tr, x + width, y + tr),
    `L ${x + width} ${y + height - br}`,
    arc(br, x + width - br, y + height),
    `L ${x + bl} ${y + height}`,
    arc(bl, x, y + height - bl),
    `L ${x} ${y + tl}`,
    arc(tl, x + tl, y),
    'Z',
  ].join(' ');
}
