import type { DesignNode } from './types.ts';
import type { SolidPaint, SolidStrokePaint } from './features.ts';

export function fillLayers(node: DesignNode): SolidPaint[] {
  return (
    node.appearance?.fills ?? [
      {
        type: 'solid',
        color: node.fill,
        opacity: node.appearance?.fillOpacity ?? 1,
      },
    ]
  );
}

export function strokeLayers(node: DesignNode): SolidStrokePaint[] {
  if (node.appearance?.strokes) return node.appearance.strokes;
  const appearance = node.appearance;
  return appearance?.strokeWidth
    ? [
        {
          type: 'solid',
          color: appearance.stroke,
          opacity: appearance.strokeOpacity ?? 1,
          width: appearance.strokeWidth,
        },
      ]
    : [];
}
