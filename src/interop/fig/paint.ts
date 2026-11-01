import { defaultAppearance } from '../../model/features.ts';
import type { SolidPaint, SolidStrokePaint } from '../../model/features.ts';
import type { DesignNode } from '../../model/types.ts';
import { record, number } from './geometry.ts';
import type { FigRecord } from './geometry.ts';

export type Warn = (message: string) => void;
const unit = (value: unknown, fallback = 1) => Math.max(0, Math.min(1, number(value, fallback)));
function paints(value: unknown, warn: Warn): SolidPaint[] {
  if (!Array.isArray(value)) return [];
  const visible = value.map(record).filter((p) => p.visible !== false);
  if (visible.some((p) => p.type !== 'SOLID' && p.type !== 'IMAGE'))
    warn('Gradient and other unsupported paints are omitted.');
  return visible
    .filter((p) => p.type === 'SOLID')
    .map((p) => {
      const c = record(p.color);
      if (p.blendMode && p.blendMode !== 'NORMAL') warn('Paint blend modes are not preserved.');
      return {
        type: 'solid' as const,
        color:
          '#' +
          ['r', 'g', 'b']
            .map((k) =>
              Math.round(unit(c[k], 0) * 255)
                .toString(16)
                .padStart(2, '0'),
            )
            .join(''),
        opacity: unit(c.a) * unit(p.opacity),
      };
    });
}
export function figPaint(n: FigRecord, scale: number, warn: Warn): Partial<DesignNode> {
  const fills = paints(n.fillPaints, warn),
    strokeWidth = number(n.strokeWeight, 1) * scale,
    strokes: SolidStrokePaint[] = paints(n.strokePaints, warn).map((paint) => ({
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
    fill: fills[0]?.color ?? '#000000',
    opacity: unit(n.opacity),
    appearance: {
      ...defaultAppearance(),
      fills,
      strokes,
      fillOpacity: fills[0]?.opacity ?? 0,
      stroke: strokes[0]?.color ?? '#000000',
      strokeWidth: strokes[0]?.width ?? 0,
      strokeOpacity: strokes[0]?.opacity ?? 1,
    },
  };
}
