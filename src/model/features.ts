import type { DesignNode, Point } from './types.ts';
export interface AutoLayout {
  direction: 'horizontal' | 'vertical';
  gap: number;
  padding: { top: number; right: number; bottom: number; left: number };
  align: 'start' | 'center' | 'end';
  justify: 'start' | 'center' | 'end' | 'space-between';
}
export interface Sizing {
  width: 'fixed' | 'hug' | 'fill';
  height: 'fixed' | 'hug' | 'fill';
}
export const BLEND_MODES = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];
export const STROKE_STYLES = ['solid', 'dashed', 'dotted'] as const;
export type StrokeStyle = (typeof STROKE_STYLES)[number];
/** A paint layer is drawn in array order, from back to front. */
export interface SolidPaint {
  type: 'solid';
  color: string;
  opacity: number;
}
export interface SolidStrokePaint extends SolidPaint {
  width: number;
}
export interface Appearance {
  stroke: string;
  strokeWidth: number;
  /**
   * Optional richer paint stacks. When omitted, the legacy node fill and
   * appearance stroke fields remain the single visible paints.
   */
  fills?: SolidPaint[];
  strokes?: SolidStrokePaint[];
  /** Independent paint alpha; omitted means opaque. */
  fillOpacity?: number;
  strokeOpacity?: number;
  /** Omitted means solid / normal so older documents load unchanged. */
  strokeStyle?: StrokeStyle;
  blendMode?: BlendMode;
  gradient: { enabled: boolean; end: string; angle: number };
  shadow: { enabled: boolean; x: number; y: number; blur: number; color: string; opacity: number };
  blur: number;
}
export interface ImageAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
}
export interface ImageFill {
  opacity?: number;
  src: string;
  fit: 'cover' | 'contain' | 'stretch';
  focalX: number;
  focalY: number;
  naturalWidth: number;
  naturalHeight: number;
  adjustments?: ImageAdjustments;
}
/** Coordinates are normalized to the layer box; rings support holes and compound paths. */
export interface VectorPoint extends Point {
  in?: Point;
  out?: Point;
  smooth?: boolean;
  /** Per-corner radius in document units; falls back to the layer radius. */
  radius?: number;
}
export interface VectorPath {
  fillRule?: 'nonzero' | 'evenodd';
  rings: VectorPoint[][];
  closed: boolean;
}
export interface LayoutGrid {
  type: 'grid' | 'columns' | 'rows';
  size: number;
  count: number;
  gutter: number;
  margin: number;
  visible: boolean;
}
export interface NodeFeatures {
  maskId?: string;
  layout?: AutoLayout;
  sizing?: Sizing;
  appearance?: Appearance;
  image?: ImageFill;
  vector?: VectorPath;
  /** Path (normalized to the layer box) that a text layer's glyphs follow. */
  textPath?: VectorPath;
  component?: { kind: 'main' | 'instance'; sourceId?: string };
  instanceSource?: string;
  overrides?: string[];
  prototype?: { targetId: string; transition: 'instant' | 'dissolve'; duration: number };
  layoutGrid?: LayoutGrid;
}
export interface Page {
  id: string;
  name: string;
  nodes: DesignNode[];
}
/** The active page's live layers are doc.nodes; its archived nodes array is empty. */
export interface Workspace {
  activePageId: string;
  pages: Page[];
  rulers: boolean;
  guidesVisible: boolean;
  guides: { id: string; axis: 'x' | 'y'; position: number }[];
}
export function defaultAppearance(): Appearance {
  return {
    stroke: '#000000',
    strokeWidth: 0,
    gradient: { enabled: false, end: '#0d99ff', angle: 90 },
    shadow: { enabled: false, x: 0, y: 4, blur: 8, color: '#000000', opacity: 0.25 },
    blur: 0,
  };
}
export function defaultImageAdjustments(): ImageAdjustments {
  return { brightness: 100, contrast: 100, saturation: 100 };
}
export function defaultLayout(): AutoLayout {
  return {
    direction: 'horizontal',
    gap: 16,
    padding: { top: 16, right: 16, bottom: 16, left: 16 },
    align: 'start',
    justify: 'start',
  };
}
export function defaultGrid(): LayoutGrid {
  return { type: 'columns', count: 12, size: 8, gutter: 16, margin: 24, visible: true };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, min = 0, max = 1e6) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const color = (v: unknown) => typeof v === 'string' && /^#[\da-f]{6}$/i.test(v);
const member = (v: unknown, values: string[]) => typeof v === 'string' && values.includes(v);
function solidPaint(v: unknown): boolean {
  return object(v) && v.type === 'solid' && color(v.color) && num(v.opacity, 0, 1);
}
function solidStrokePaint(v: unknown): boolean {
  return object(v) && solidPaint(v) && num(v.width, 0, 1000);
}
function validVectorPath(v: unknown): boolean {
  return (
    object(v) &&
    typeof v.closed === 'boolean' &&
    (v.fillRule === undefined || member(v.fillRule, ['nonzero', 'evenodd'])) &&
    Array.isArray(v.rings) &&
    v.rings.length > 0 &&
    v.rings.length <= 1000 &&
    v.rings.every(
      (r) =>
        Array.isArray(r) &&
        r.length >= 2 &&
        r.length <= 10000 &&
        r.every(
          (p) =>
            object(p) &&
            num(p.x, -1000, 1000) &&
            num(p.y, -1000, 1000) &&
            (p.smooth === undefined || typeof p.smooth === 'boolean') &&
            ['in', 'out'].every(
              (key) =>
                p[key] === undefined ||
                (object(p[key]) && num(p[key].x, -1000, 1000) && num(p[key].y, -1000, 1000)),
            ),
        ),
    )
  );
}
export function validFeatures(n: Record<string, unknown>): boolean {
  if (n.maskId !== undefined && (n.type !== 'group' || typeof n.maskId !== 'string' || !n.maskId))
    return false;
  const l = n.layout,
    s = n.sizing,
    a = n.appearance,
    i = n.image,
    v = n.vector,
    c = n.component,
    p = n.prototype,
    g = n.layoutGrid;
  if (
    l !== undefined &&
    (!object(l) ||
      n.type !== 'frame' ||
      !member(l.direction, ['horizontal', 'vertical']) ||
      !num(l.gap) ||
      !object(l.padding) ||
      !['top', 'right', 'bottom', 'left'].every((k) =>
        num((l.padding as Record<string, unknown>)[k]),
      ) ||
      !member(l.align, ['start', 'center', 'end']) ||
      !member(l.justify, ['start', 'center', 'end', 'space-between']))
  )
    return false;
  if (
    s !== undefined &&
    (!object(s) ||
      !member(s.width, ['fixed', 'hug', 'fill']) ||
      !member(s.height, ['fixed', 'hug', 'fill']))
  )
    return false;
  if (
    a !== undefined &&
    (!object(a) ||
      !color(a.stroke) ||
      !num(a.strokeWidth, 0, 1000) ||
      !num(a.blur, 0, 1000) ||
      (a.fills !== undefined &&
        (!Array.isArray(a.fills) || a.fills.length > 100 || !a.fills.every(solidPaint))) ||
      (a.strokes !== undefined &&
        (!Array.isArray(a.strokes) ||
          a.strokes.length > 100 ||
          !a.strokes.every(solidStrokePaint))) ||
      (a.fillOpacity !== undefined && !num(a.fillOpacity, 0, 1)) ||
      (a.strokeOpacity !== undefined && !num(a.strokeOpacity, 0, 1)) ||
      (a.strokeStyle !== undefined && !member(a.strokeStyle, [...STROKE_STYLES])) ||
      (a.blendMode !== undefined && !member(a.blendMode, [...BLEND_MODES])) ||
      !object(a.gradient) ||
      typeof a.gradient.enabled !== 'boolean' ||
      !color(a.gradient.end) ||
      !num(a.gradient.angle, -1e6) ||
      !object(a.shadow) ||
      typeof a.shadow.enabled !== 'boolean' ||
      !num(a.shadow.x, -1e6) ||
      !num(a.shadow.y, -1e6) ||
      !num(a.shadow.blur, 0, 1000) ||
      !color(a.shadow.color) ||
      !num(a.shadow.opacity, 0, 1))
  )
    return false;
  if (
    i !== undefined &&
    (!object(i) ||
      !['rectangle', 'ellipse', 'frame'].includes(String(n.type)) ||
      !isRasterData(i.src) ||
      (i.opacity !== undefined && !num(i.opacity, 0, 1)) ||
      !member(i.fit, ['cover', 'contain', 'stretch']) ||
      !num(i.focalX, 0, 1) ||
      !num(i.focalY, 0, 1) ||
      !num(i.naturalWidth, 1, 100000) ||
      !num(i.naturalHeight, 1, 100000) ||
      (i.adjustments !== undefined &&
        (!object(i.adjustments) ||
          !num(i.adjustments.brightness, 0, 200) ||
          !num(i.adjustments.contrast, 0, 200) ||
          !num(i.adjustments.saturation, 0, 200))))
  )
    return false;
  if (v !== undefined && (n.type !== 'path' || !validVectorPath(v))) return false;
  if (n.textPath !== undefined && (n.type !== 'text' || !validVectorPath(n.textPath))) return false;
  if (n.type === 'path' && v === undefined) return false;
  if (
    c !== undefined &&
    (!object(c) ||
      n.type !== 'frame' ||
      !member(c.kind, ['main', 'instance']) ||
      (c.kind === 'instance' && (typeof c.sourceId !== 'string' || !c.sourceId)))
  )
    return false;
  if (n.instanceSource !== undefined && typeof n.instanceSource !== 'string') return false;
  if (
    n.overrides !== undefined &&
    (!Array.isArray(n.overrides) ||
      !n.overrides.every((k) => typeof k === 'string' && k.length < 100))
  )
    return false;
  if (
    p !== undefined &&
    (!object(p) ||
      typeof p.targetId !== 'string' ||
      !member(p.transition, ['instant', 'dissolve']) ||
      !num(p.duration, 0, 10000))
  )
    return false;
  if (
    g !== undefined &&
    (!object(g) ||
      n.type !== 'frame' ||
      !member(g.type, ['grid', 'columns', 'rows']) ||
      !num(g.size, 1, 10000) ||
      !num(g.count, 1, 100) ||
      !Number.isInteger(g.count) ||
      !num(g.gutter, 0, 10000) ||
      !num(g.margin, 0, 10000) ||
      typeof g.visible !== 'boolean')
  )
    return false;
  return true;
}
export function isRasterData(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 12 * 1024 * 1024 &&
    /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(value)
  );
}
