import { createDocument, createNode, validateDocument } from '../model/document.ts';
import { defaultAppearance } from '../model/features.ts';
import type { VectorPoint } from '../model/features.ts';
import { vectorFromPoints } from '../model/vector.ts';
import type { DesignDocument, DesignNode, Point } from '../model/types.ts';

type Matrix = [number, number, number, number, number, number];
interface Style {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillAlpha: number;
  strokeAlpha: number;
  fillOpacity: number;
  strokeOpacity: number;
  color: string;
  opacity: number;
  fontSize: number;
}
interface Ring {
  points: VectorPoint[];
  closed: boolean;
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const MAX_NODES = 5000;
const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  lime: '#00ff00',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  aqua: '#00ffff',
  magenta: '#ff00ff',
  fuchsia: '#ff00ff',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  maroon: '#800000',
  olive: '#808000',
  purple: '#800080',
  teal: '#008080',
  navy: '#000080',
  orange: '#ffa500',
  pink: '#ffc0cb',
  brown: '#a52a2a',
  transparent: 'none',
};

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m: Matrix, p: Point): Point => ({
  x: m[0] * p.x + m[2] * p.y + m[4],
  y: m[1] * p.x + m[3] * p.y + m[5],
});
const num = (value: string | null | undefined, fallback = 0): number => {
  const n = parseFloat(value ?? '');
  return Number.isFinite(n) ? n : fallback;
};

const opacity = (value: string | null | undefined, fallback = 1): number =>
  Math.max(
    0,
    Math.min(
      1,
      value?.trim().endsWith('%') ? num(value, fallback * 100) / 100 : num(value, fallback),
    ),
  );

function parseTransform(value: string | null): Matrix {
  let m = IDENTITY;
  for (const [, name, args] of (value ?? '').matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const a = (args ?? '')
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (a.some((n) => !Number.isFinite(n))) continue;
    const [p, q = 0, r = 0, s = 0, t = 0, u = 0] = a;
    let next: Matrix | null = null;
    if (name === 'translate') next = [1, 0, 0, 1, p ?? 0, q];
    else if (name === 'scale') next = [p ?? 1, 0, 0, a.length > 1 ? q : (p ?? 1), 0, 0];
    else if (name === 'rotate') {
      const rad = ((p ?? 0) * Math.PI) / 180,
        c = Math.cos(rad),
        sn = Math.sin(rad);
      next = [c, sn, -sn, c, 0, 0];
      if (a.length === 3) next = multiply(multiply([1, 0, 0, 1, q, r], next), [1, 0, 0, 1, -q, -r]);
    } else if (name === 'skewX') next = [1, 0, Math.tan(((p ?? 0) * Math.PI) / 180), 1, 0, 0];
    else if (name === 'skewY') next = [1, Math.tan(((p ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
    else if (name === 'matrix' && a.length === 6) next = [p!, q, r, s, t, u];
    if (next) m = multiply(m, next);
  }
  return m;
}

/** Returns a #rrggbb color plus alpha, or 'none' for unpainted. */
function parseColor(value: string, current: string): { color: string; alpha: number } | 'none' {
  const v = value.trim().toLowerCase();
  if (!v || v === 'none') return 'none';
  if (v === 'currentcolor') return { color: current, alpha: 1 };
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    const h = m[1]!;
    if (h.length === 3 || h.length === 4)
      return {
        color: '#' + [...h.slice(0, 3)].map((c) => c + c).join(''),
        alpha: h.length === 4 ? parseInt(h[3]! + h[3]!, 16) / 255 : 1,
      };
    if (h.length === 6 || h.length === 8)
      return {
        color: '#' + h.slice(0, 6),
        alpha: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1,
      };
  }
  m = /^rgba?\(([^)]+)\)$/.exec(v);
  if (m) {
    const parts = m[1]!.split(/[\s,/]+/).filter(Boolean);
    const [r, g, b] = parts.slice(0, 3).map((p) => {
      const n = parseFloat(p);
      return Math.max(0, Math.min(255, Math.round(p.endsWith('%') ? (n * 255) / 100 : n)));
    });
    if ([r, g, b].every((n) => Number.isFinite(n)))
      return {
        color: '#' + [r, g, b].map((n) => n!.toString(16).padStart(2, '0')).join(''),
        alpha: opacity(parts[3]),
      };
  }
  const named = NAMED[v];
  if (named) return named === 'none' ? 'none' : { color: named, alpha: 1 };
  // Gradients, patterns and unknown paint servers fall back to the app's default gray.
  return { color: '#d9d9d9', alpha: 1 };
}

function readStyle(el: Element, parent: Style): Style {
  const props = new Map<string, string>();
  for (const name of [
    'fill',
    'stroke',
    'stroke-width',
    'opacity',
    'fill-opacity',
    'stroke-opacity',
    'font-size',
    'color',
  ]) {
    const v = el.getAttribute(name);
    if (v !== null) props.set(name, v);
  }
  for (const decl of (el.getAttribute('style') ?? '').split(';')) {
    const i = decl.indexOf(':');
    if (i > 0) props.set(decl.slice(0, i).trim().toLowerCase(), decl.slice(i + 1).trim());
  }
  const current = props.has('color')
    ? parseColor(props.get('color')!, parent.color)
    : { color: parent.color, alpha: 1 };
  const currentColor = current === 'none' ? '#000000' : current.color;
  const paint = (name: 'fill' | 'stroke') => {
    const raw = props.get(name);
    return raw === undefined || raw === 'inherit'
      ? { color: parent[name], alpha: parent[name === 'fill' ? 'fillAlpha' : 'strokeAlpha'] }
      : parseColor(raw, currentColor);
  };
  const fill = paint('fill'),
    stroke = paint('stroke');
  return {
    fill: fill === 'none' ? 'none' : fill.color,
    stroke: stroke === 'none' ? 'none' : stroke.color,
    fillAlpha: fill === 'none' ? 1 : fill.alpha,
    strokeAlpha: stroke === 'none' ? 1 : stroke.alpha,
    fillOpacity: opacity(props.get('fill-opacity'), parent.fillOpacity),
    strokeOpacity: opacity(props.get('stroke-opacity'), parent.strokeOpacity),
    color: currentColor,
    strokeWidth: props.has('stroke-width') ? num(props.get('stroke-width'), 1) : parent.strokeWidth,
    opacity: parent.opacity * opacity(props.get('opacity')),
    fontSize: props.has('font-size') ? num(props.get('font-size'), 16) : parent.fontSize,
  };
}

function arcToCubics(
  from: Point,
  rx: number,
  ry: number,
  rotation: number,
  large: boolean,
  sweep: boolean,
  to: Point,
): { c1: Point; c2: Point; end: Point }[] {
  if (rx === 0 || ry === 0 || (from.x === to.x && from.y === to.y))
    return [{ c1: from, c2: to, end: to }];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (rotation * Math.PI) / 180,
    cos = Math.cos(phi),
    sin = Math.sin(phi),
    dx = (from.x - to.x) / 2,
    dy = (from.y - to.y) / 2,
    x1 = cos * dx + sin * dy,
    y1 = -sin * dx + cos * dy,
    scale = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (scale > 1) {
    rx *= Math.sqrt(scale);
    ry *= Math.sqrt(scale);
  }
  const sign = large === sweep ? -1 : 1,
    num2 = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1,
    den = rx * rx * y1 * y1 + ry * ry * x1 * x1,
    k = sign * Math.sqrt(Math.max(0, num2 / den)),
    cxp = (k * rx * y1) / ry,
    cyp = (-k * ry * x1) / rx,
    cx = cos * cxp - sin * cyp + (from.x + to.x) / 2,
    cy = sin * cxp + cos * cyp + (from.y + to.y) / 2,
    angle = (ux: number, uy: number, vx: number, vy: number) =>
      Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta = angle(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
  let delta = angle((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;
  const count = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2))),
    step = delta / count,
    t = (4 / 3) * Math.tan(step / 4),
    point = (a: number, dr = false): Point => {
      const px = rx * Math.cos(a),
        py = ry * Math.sin(a),
        tx = -rx * Math.sin(a),
        ty = ry * Math.cos(a);
      const [ex, ey] = dr ? [tx, ty] : [px, py];
      return dr
        ? { x: cos * ex - sin * ey, y: sin * ex + cos * ey }
        : { x: cos * ex - sin * ey + cx, y: sin * ex + cos * ey + cy };
    };
  const out: { c1: Point; c2: Point; end: Point }[] = [];
  for (let i = 0; i < count; i++) {
    const a1 = theta + i * step,
      a2 = a1 + step,
      p1 = point(a1),
      p2 = point(a2),
      d1 = point(a1, true),
      d2 = point(a2, true);
    out.push({
      c1: { x: p1.x + t * d1.x, y: p1.y + t * d1.y },
      c2: { x: p2.x - t * d2.x, y: p2.y - t * d2.y },
      end: i === count - 1 ? to : p2,
    });
  }
  return out;
}

/** Parses SVG path data into rings of bezier points in the path's own coordinates. */
export function parsePathData(d: string): Ring[] {
  const rings: Ring[] = [];
  let ring = null as Ring | null,
    cur: Point = { x: 0, y: 0 },
    start: Point = { x: 0, y: 0 },
    lastCubic = null as Point | null,
    lastQuad = null as Point | null,
    i = 0,
    cmd = '';
  const numberAt = /^[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/;
  const skip = () => {
    while (i < d.length && /[\s,]/.test(d[i]!)) i++;
  };
  const read = (): number => {
    skip();
    const m = numberAt.exec(d.slice(i));
    if (!m) throw new Error('Invalid SVG path data.');
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const flag = (): boolean => {
    skip();
    const c = d[i++];
    if (c !== '0' && c !== '1') throw new Error('Invalid SVG path data.');
    return c === '1';
  };
  const begin = (p: Point) => {
    ring = { points: [{ ...p }], closed: false };
    rings.push(ring);
  };
  const line = (p: Point) => {
    if (!ring) begin(cur);
    ring!.points.push({ ...p });
    cur = p;
  };
  const cubic = (c1: Point, c2: Point, p: Point) => {
    if (!ring) begin(cur);
    ring!.points.at(-1)!.out = c1;
    ring!.points.push({ ...p, in: c2 });
    cur = p;
    lastCubic = c2;
  };
  while (true) {
    skip();
    if (i >= d.length) break;
    if (/[A-Za-z]/.test(d[i]!)) cmd = d[i++]!;
    else if (!cmd) throw new Error('Invalid SVG path data.');
    else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
    else if (cmd === 'Z' || cmd === 'z') throw new Error('Invalid SVG path data.');
    const rel = cmd === cmd.toLowerCase(),
      ox = rel ? cur.x : 0,
      oy = rel ? cur.y : 0,
      upper = cmd.toUpperCase();
    const prevCubic = lastCubic,
      prevQuad = lastQuad;
    lastCubic = null;
    lastQuad = null;
    if (upper === 'M') {
      cur = { x: ox + read(), y: oy + read() };
      start = cur;
      begin(cur);
    } else if (upper === 'L') line({ x: ox + read(), y: oy + read() });
    else if (upper === 'H') line({ x: ox + read(), y: cur.y });
    else if (upper === 'V') line({ x: cur.x, y: oy + read() });
    else if (upper === 'C') {
      const c1 = { x: ox + read(), y: oy + read() },
        c2 = { x: ox + read(), y: oy + read() };
      cubic(c1, c2, { x: ox + read(), y: oy + read() });
    } else if (upper === 'S') {
      const c1 = prevCubic ? { x: 2 * cur.x - prevCubic.x, y: 2 * cur.y - prevCubic.y } : cur,
        c2 = { x: ox + read(), y: oy + read() };
      cubic(c1, c2, { x: ox + read(), y: oy + read() });
    } else if (upper === 'Q' || upper === 'T') {
      let q: Point;
      if (upper === 'Q') q = { x: ox + read(), y: oy + read() };
      else q = prevQuad ? { x: 2 * cur.x - prevQuad.x, y: 2 * cur.y - prevQuad.y } : cur;
      const p = { x: ox + read(), y: oy + read() },
        from = cur;
      cubic(
        { x: from.x + (2 / 3) * (q.x - from.x), y: from.y + (2 / 3) * (q.y - from.y) },
        { x: p.x + (2 / 3) * (q.x - p.x), y: p.y + (2 / 3) * (q.y - p.y) },
        p,
      );
      lastCubic = null;
      lastQuad = q;
    } else if (upper === 'A') {
      const rx = read(),
        ry = read(),
        rot = read(),
        large = flag(),
        sweep = flag(),
        p = { x: ox + read(), y: oy + read() };
      for (const seg of arcToCubics(cur, rx, ry, rot, large, sweep, p))
        cubic(seg.c1, seg.c2, seg.end);
      lastCubic = null;
    } else if (upper === 'Z') {
      if (ring) {
        const pts = ring.points,
          first = pts[0]!,
          last = pts.at(-1)!;
        if (pts.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) < 1e-6) {
          if (last.in) first.in = last.in;
          pts.pop();
        }
        ring.closed = true;
      }
      cur = start;
      ring = null;
    } else throw new Error('Invalid SVG path data.');
  }
  return rings.filter((r) => r.points.length > 1);
}

const rectRing = (x: number, y: number, w: number, h: number): Ring => ({
  points: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
  closed: true,
});
const K = 0.5522847498;
function ellipseRing(cx: number, cy: number, rx: number, ry: number): Ring {
  return {
    closed: true,
    points: [
      {
        x: cx + rx,
        y: cy,
        in: { x: cx + rx, y: cy - K * ry },
        out: { x: cx + rx, y: cy + K * ry },
      },
      {
        x: cx,
        y: cy + ry,
        in: { x: cx + K * rx, y: cy + ry },
        out: { x: cx - K * rx, y: cy + ry },
      },
      {
        x: cx - rx,
        y: cy,
        in: { x: cx - rx, y: cy + K * ry },
        out: { x: cx - rx, y: cy - K * ry },
      },
      {
        x: cx,
        y: cy - ry,
        in: { x: cx - K * rx, y: cy - ry },
        out: { x: cx + K * rx, y: cy - ry },
      },
    ],
  };
}

export function importSvg(source: string, filename = 'Imported'): DesignDocument {
  const xml = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = xml.documentElement;
  if (!root || root.localName !== 'svg' || xml.querySelector('parsererror'))
    throw new Error('This file is not a valid SVG.');
  const doc = createDocument();
  doc.name = filename;
  const nodes: DesignNode[] = [];
  const add = (node: DesignNode) => {
    if (nodes.length >= MAX_NODES) throw new Error('SVG has too many shapes (limit 5000).');
    nodes.push(node);
  };

  let base = IDENTITY;
  const viewBox = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  if (
    viewBox.length === 4 &&
    viewBox.every(Number.isFinite) &&
    viewBox[2]! > 0 &&
    viewBox[3]! > 0
  ) {
    const dimension = (name: string, fallback: number) => {
      const value = root.getAttribute(name);
      return value && !value.includes('%') && num(value) > 0 ? num(value) : fallback;
    };
    const width = dimension('width', viewBox[2]!),
      height = dimension('height', viewBox[3]!);
    let sx = width / viewBox[2]!,
      sy = height / viewBox[3]!;
    const parts = (root.getAttribute('preserveAspectRatio') ?? 'xMidYMid meet')
      .trim()
      .split(/\s+/)
      .filter((p) => p !== 'defer');
    const align = parts[0] ?? 'xMidYMid';
    let tx = 0,
      ty = 0;
    if (align !== 'none') {
      sx = sy = (parts[1] === 'slice' ? Math.max : Math.min)(sx, sy);
      tx =
        (width - viewBox[2]! * sx) *
        (align.includes('xMax') ? 1 : align.includes('xMin') ? 0 : 0.5);
      ty =
        (height - viewBox[3]! * sy) *
        (align.includes('YMax') ? 1 : align.includes('YMin') ? 0 : 0.5);
    }
    base = multiply([sx, 0, 0, sy, tx, ty], [1, 0, 0, 1, -viewBox[0]!, -viewBox[1]!]);
  }

  const paintProps = (
    style: Style,
    m: Matrix,
  ): Partial<DesignNode> & { hasFill: boolean; hasStroke: boolean } => {
    const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])),
      hasFill = style.fill !== 'none',
      hasStroke = style.stroke !== 'none' && style.strokeWidth > 0;
    return {
      hasFill,
      hasStroke,
      fill: hasFill ? style.fill : '#d9d9d9',
      opacity: style.opacity,
      ...(hasStroke || style.fillAlpha * style.fillOpacity !== 1
        ? {
            appearance: {
              ...defaultAppearance(),
              fillOpacity: style.fillAlpha * style.fillOpacity,
              strokeOpacity: style.strokeAlpha * style.strokeOpacity,
              stroke: hasStroke ? style.stroke : '#000000',
              strokeWidth: hasStroke ? style.strokeWidth * scale : 0,
            },
          }
        : {}),
    };
  };

  const emitPath = (rings: Ring[], style: Style, m: Matrix, name: string) => {
    const paint = paintProps(style, m);
    if (!paint.hasFill && !paint.hasStroke) return;
    const mapped = rings.map((r) => ({
      closed: r.closed,
      points: r.points.map((p): VectorPoint => ({
        ...p,
        ...apply(m, p),
        ...(p.in ? { in: apply(m, p.in) } : {}),
        ...(p.out ? { out: apply(m, p.out) } : {}),
      })),
    }));
    let closed = true,
      list: VectorPoint[][];
    if (paint.hasFill) list = mapped.map((r) => r.points);
    else {
      // Unfilled outlines stay open; closed subpaths get an explicit closing point.
      closed = false;
      list = mapped.map((r) => {
        if (!r.closed) return r.points;
        const first = r.points[0]!;
        return [...r.points, { x: first.x, y: first.y, ...(first.in ? { in: first.in } : {}) }];
      });
    }
    const props = visual(paint);
    add(createNode('path', { ...props, ...vectorFromPoints(list, closed), name }));
  };

  const visual = (paint: ReturnType<typeof paintProps>): Partial<DesignNode> => {
    const rest: Partial<DesignNode> & { hasFill?: boolean; hasStroke?: boolean } = { ...paint };
    delete rest.hasFill;
    delete rest.hasStroke;
    return rest;
  };
  const nativeScale = (m: Matrix) => m[1] === 0 && m[2] === 0 && m[0] !== 0 && m[3] !== 0;

  const visit = (el: Element, parentMatrix: Matrix, parentStyle: Style): void => {
    const tag = el.localName;
    if (
      ['defs', 'style', 'metadata', 'title', 'desc', 'clippath', 'mask', 'symbol', 'use'].includes(
        tag.toLowerCase(),
      )
    )
      return;
    if (el.getAttribute('display') === 'none' || el.getAttribute('visibility') === 'hidden') return;
    const m = multiply(parentMatrix, parseTransform(el.getAttribute('transform')));
    const style = readStyle(el, parentStyle);
    if (tag === 'g' || tag === 'svg' || tag === 'a') {
      for (const child of el.children) visit(child, m, style);
      return;
    }
    const f = (name: string) => num(el.getAttribute(name));
    if (tag === 'rect' || tag === 'circle' || tag === 'ellipse') {
      let x: number,
        y: number,
        w: number,
        h: number,
        rx = 0;
      if (tag === 'rect') {
        [x, y, w, h] = [f('x'), f('y'), f('width'), f('height')] as [
          number,
          number,
          number,
          number,
        ];
        rx = Math.min(num(el.getAttribute('rx'), num(el.getAttribute('ry'))), w / 2, h / 2);
      } else if (tag === 'circle') {
        const r = f('r');
        [x, y, w, h] = [f('cx') - r, f('cy') - r, r * 2, r * 2];
      } else {
        const rx2 = f('rx'),
          ry2 = f('ry');
        [x, y, w, h] = [f('cx') - rx2, f('cy') - ry2, rx2 * 2, ry2 * 2];
      }
      if (!(w > 0 && h > 0)) return;
      const paint = paintProps(style, m);
      if (!paint.hasFill && !paint.hasStroke) return;
      if (nativeScale(m) && paint.hasFill) {
        const p = apply(m, { x, y }),
          q = apply(m, { x: x + w, y: y + h }),
          props = visual(paint);
        add(
          createNode(tag === 'rect' ? 'rectangle' : 'ellipse', {
            ...props,
            x: Math.min(p.x, q.x),
            y: Math.min(p.y, q.y),
            width: Math.max(Math.abs(q.x - p.x), 1),
            height: Math.max(Math.abs(q.y - p.y), 1),
            radius: tag === 'rect' ? rx * Math.abs(m[0]) : 0,
            name: tag === 'rect' ? 'Rectangle' : 'Ellipse',
          }),
        );
      } else
        emitPath(
          [tag === 'rect' ? rectRing(x, y, w, h) : ellipseRing(x + w / 2, y + h / 2, w / 2, h / 2)],
          style,
          m,
          tag === 'rect' ? 'Rectangle' : 'Ellipse',
        );
    } else if (tag === 'line')
      emitPath(
        [
          {
            closed: false,
            points: [
              { x: f('x1'), y: f('y1') },
              { x: f('x2'), y: f('y2') },
            ],
          },
        ],
        { ...style, fill: 'none' },
        m,
        'Line',
      );
    else if (tag === 'polyline' || tag === 'polygon') {
      const values = (el.getAttribute('points') ?? '')
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      if (values.some((n) => !Number.isFinite(n))) return;
      const points: VectorPoint[] = [];
      for (let k = 0; k + 1 < values.length; k += 2)
        points.push({ x: values[k]!, y: values[k + 1]! });
      if (points.length > 1)
        emitPath(
          [{ points, closed: tag === 'polygon' }],
          style,
          m,
          tag === 'polygon' ? 'Polygon' : 'Polyline',
        );
    } else if (tag === 'path') {
      const rings = parsePathData(el.getAttribute('d') ?? '');
      if (rings.length) emitPath(rings, style, m, 'Path');
    } else if (tag === 'text') {
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ');
      const paint = paintProps({ ...style, stroke: 'none' }, m);
      if (!text || !paint.hasFill) return;
      const size = Math.max(1, style.fontSize * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]))),
        p = apply(m, { x: f('x'), y: f('y') });
      const props = visual(paint);
      add(
        createNode('text', {
          ...props,
          text,
          fontSize: size,
          x: p.x,
          y: p.y - size,
          width: Math.max(20, text.length * size * 0.6),
          height: size * 1.4,
          name: text.slice(0, 24),
        }),
      );
    }
  };

  visit(root, base, {
    fill: '#000000',
    stroke: 'none',
    strokeWidth: 1,
    opacity: 1,
    fontSize: 16,
    fillAlpha: 1,
    strokeAlpha: 1,
    fillOpacity: 1,
    strokeOpacity: 1,
    color: '#000000',
  });
  if (!nodes.length) throw new Error('No supported shapes found in this SVG.');
  doc.nodes = nodes;
  return validateDocument(doc);
}

export function looksLikeSvg(file: File, text: string): boolean {
  return (
    file.type === 'image/svg+xml' || /\.svg$/i.test(file.name) || /^\s*(<\?xml|<svg)/i.test(text)
  );
}
