import { defaultAppearance } from '../../model/features.ts';
import type { DesignNode } from '../../model/types.ts';
import { record, number } from './geometry.ts';
import type { FigRecord } from './geometry.ts';

export type Warn = (message: string) => void;
const unit = (value: unknown, fallback = 1) => Math.max(0, Math.min(1, number(value, fallback)));
function paint(value: unknown, warn: Warn): { color: string; alpha: number } | null {
  if (!Array.isArray(value)) return null;
  const visible = value.map(record).filter((p) => p.visible !== false);
  if (visible.length > 1) warn('Multiple paints are reduced to the first visible solid paint.');
  if (visible.some((p) => p.type !== 'SOLID' && p.type !== 'IMAGE'))
    warn('Gradient and other unsupported paints are omitted.');
  const p = visible.find((p) => p.type === 'SOLID');
  if (!p) return null;
  const c = record(p.color);
  if (p.blendMode && p.blendMode !== 'NORMAL') warn('Paint blend modes are not preserved.');
  return {
    color:
      '#' +
      ['r', 'g', 'b']
        .map((k) =>
          Math.round(unit(c[k], 0) * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join(''),
    alpha: unit(c.a) * unit(p.opacity),
  };
}
export function figPaint(n: FigRecord, scale: number, warn: Warn): Partial<DesignNode> {
  const fill = paint(n.fillPaints, warn),
    stroke = paint(n.strokePaints, warn);
  const strokeWidth = stroke ? number(n.strokeWeight, 1) * scale : 0;
  if (stroke && n.strokeAlign && n.strokeAlign !== 'CENTER')
    warn('Inside/outside strokes are approximated by centered strokes.');
  if (Array.isArray(n.dashPattern) && n.dashPattern.length)
    warn('Custom dash patterns are imported as solid strokes.');
  if (Array.isArray(n.effects) && n.effects.some((e) => record(e).visible !== false))
    warn('Effects are omitted.');
  if (n.blendMode && !['NORMAL', 'PASS_THROUGH'].includes(String(n.blendMode)))
    warn('Layer blend modes are not preserved.');
  if (n.mask === true) warn('Mask relationships are not preserved.');
  return {
    fill: fill?.color ?? '#000000',
    opacity: unit(n.opacity),
    appearance: {
      ...defaultAppearance(),
      fillOpacity: fill?.alpha ?? 0,
      stroke: stroke?.color ?? '#000000',
      strokeWidth,
      strokeOpacity: stroke?.alpha ?? 1,
    },
  };
}
