import { defaultAppearance } from '../../model/features.ts';
import type { Paint, StrokePaint } from '../../model/features.ts';
import type { DesignNode } from '../../model/types.ts';
import { record, number } from './geometry.ts';
import type { FigRecord } from './geometry.ts';

export type Warn = (message: string) => void;
const unit = (value: unknown, fallback = 1) => Math.max(0, Math.min(1, number(value, fallback)));
function hex(value: unknown): string {
  const c = record(value);
  return (
    '#' +
    ['r', 'g', 'b']
      .map((k) =>
        Math.round(unit(c[k], 0) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function point(value: unknown, fallback: { x: number; y: number }) {
  const p = record(value);
  return { x: number(p.x, fallback.x), y: number(p.y, fallback.y) };
}
function paints(value: unknown, warn: Warn): Paint[] {
  if (!Array.isArray(value)) return [];
  const visible = value.map(record).filter((p) => p.visible !== false);
  return visible.flatMap((p): Paint[] => {
    if (p.blendMode && p.blendMode !== 'NORMAL') warn('Paint blend modes are not preserved.');
    if (p.type === 'SOLID')
      return [
        { type: 'solid', color: hex(p.color), opacity: unit(record(p.color).a) * unit(p.opacity) },
      ];
    if (p.type !== 'GRADIENT_LINEAR' && p.type !== 'GRADIENT_RADIAL') {
      if (p.type !== 'IMAGE') warn('Unsupported paints are omitted.');
      return [];
    }
    const stops = Array.isArray(p.gradientStops)
      ? p.gradientStops.map(record).map((stop) => ({
          color: hex(stop.color),
          opacity: unit(record(stop.color).a),
          position: unit(stop.position, 0),
        }))
      : [];
    if (stops.length < 2) {
      warn('A gradient without at least two stops is omitted.');
      return [];
    }
    stops.sort((a, b) => a.position - b.position);
    const handles = Array.isArray(p.gradientHandlePositions) ? p.gradientHandlePositions : [];
    return [
      {
        type: p.type === 'GRADIENT_LINEAR' ? 'linear' : 'radial',
        opacity: unit(p.opacity),
        stops,
        start: point(handles[0], { x: 0, y: 0.5 }),
        end: point(handles[1], { x: 1, y: 0.5 }),
        ...(p.type === 'GRADIENT_RADIAL' ? { radius: point(handles[2], { x: 0.5, y: 1 }) } : {}),
      },
    ];
  });
}
export function figPaint(n: FigRecord, scale: number, warn: Warn): Partial<DesignNode> {
  const fills = paints(n.fillPaints, warn),
    strokeWidth = number(n.strokeWeight, 1) * scale,
    strokes: StrokePaint[] = paints(n.strokePaints, warn).map((paint) => ({
      ...paint,
      width: strokeWidth,
    }));
  if (strokes.length && n.strokeAlign && n.strokeAlign !== 'CENTER')
    warn('Inside/outside strokes are approximated by centered strokes.');
  if (Array.isArray(n.dashPattern) && n.dashPattern.length)
    warn('Custom dash patterns are imported as solid strokes.');
  if (Array.isArray(n.effects) && n.effects.some((e) => record(e).visible !== false))
    warn('Effects are omitted.');
  if (n.blendMode && !['NORMAL', 'PASS_THROUGH'].includes(String(n.blendMode)))
    warn('Layer blend modes are not preserved.');
  if (n.mask === true) warn('Mask relationships are not preserved.');
  return {
    fill: fills[0]?.type === 'solid' ? fills[0].color : (fills[0]?.stops[0]?.color ?? '#000000'),
    opacity: unit(n.opacity),
    appearance: {
      ...defaultAppearance(),
      fills,
      strokes,
      fillOpacity: fills[0]?.opacity ?? 0,
      stroke:
        strokes[0]?.type === 'solid'
          ? strokes[0].color
          : (strokes[0]?.stops[0]?.color ?? '#000000'),
      strokeWidth: strokes[0]?.width ?? 0,
      strokeOpacity: strokes[0]?.opacity ?? 1,
    },
  };
}
