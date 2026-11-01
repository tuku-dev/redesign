import type { VectorPoint } from '../../model/features.ts';
import type { DesignNode, Point } from '../../model/types.ts';
import { vectorFromPoints } from '../../model/vector.ts';
import { mapVectorPoint } from '../../model/bezier.ts';
import { record, number } from './geometry.ts';
import type { FigRecord, Matrix } from './geometry.ts';
import type { Warn } from './paint.ts';
import { figError } from './limits.ts';

export interface FigRing {
  points: VectorPoint[];
  closed: boolean;
}
export function figBlob(message: FigRecord, index: unknown): Uint8Array {
  if (!Number.isInteger(index) || Number(index) < 0 || !Array.isArray(message.blobs))
    figError('invalid vector blob reference.');
  const bytes = record(message.blobs[Number(index)]).bytes;
  if (!(bytes instanceof Uint8Array)) figError('missing vector blob.');
  return bytes;
}
/** Cached path commands are float32 LE in node-local size coordinates. */
export function readFigPath(bytes: Uint8Array): FigRing[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    rings: FigRing[] = [];
  let offset = 0,
    ring: FigRing | null = null,
    points = 0;
  const point = (): Point => {
    if (offset + 8 > bytes.length) figError('truncated vector command.');
    const x = view.getFloat32(offset, true),
      y = view.getFloat32(offset + 4, true);
    offset += 8;
    if (!Number.isFinite(x) || !Number.isFinite(y)) figError('invalid vector coordinate.');
    return { x, y };
  };
  while (offset < bytes.length) {
    if (++points > 10000) figError('vector command limit exceeded.');
    const command = bytes[offset++];
    if (command === 1) {
      ring = { points: [point()], closed: false };
      rings.push(ring);
    } else if (command === 2) {
      if (!ring) figError('vector line without a move.');
      ring.points.push(point());
    } else if (command === 4) {
      if (!ring) figError('vector curve without a move.');
      const c1 = point(),
        c2 = point(),
        end = point();
      ring.points.at(-1)!.out = c1;
      ring.points.push({ ...end, in: c2 });
    } else if (command === 0) {
      if (!ring) figError('vector close without a move.');
      const first = ring.points[0],
        last = ring.points.at(-1)!;
      if (ring.points.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) < 1e-6) {
        if (last.in) first.in = last.in;
        ring.points.pop();
      }
      ring.closed = true;
      ring = null;
    } else figError('unsupported vector command.');
  }
  return rings.filter((r) => r.points.length >= 2);
}

/** Recover simple open/closed chains; branched networks use cached fill outlines instead. */
export function readFigNetwork(bytes: Uint8Array, node: FigRecord): FigRing[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const uint = () => {
    if (offset + 4 > bytes.length) figError('truncated vector network.');
    const v = view.getUint32(offset, true);
    offset += 4;
    return v;
  };
  const float = () => {
    if (offset + 4 > bytes.length) figError('truncated vector network.');
    const v = view.getFloat32(offset, true);
    offset += 4;
    if (!Number.isFinite(v)) figError('invalid vector network coordinate.');
    return v;
  };
  const nv = uint(),
    ns = uint(),
    nr = uint();
  if (nv > 10000 || ns > 10000 || nr > 1000 || 12 + nv * 12 + ns * 28 > bytes.length)
    figError('invalid or excessive vector network counts.');
  const data = record(node.vectorData),
    normalized = record(data.normalizedSize),
    size = record(node.size);
  const sx = number(size.x, 1) / number(normalized.x, number(size.x, 1) || 1),
    sy = number(size.y, 1) / number(normalized.y, number(size.y, 1) || 1);
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) figError('invalid normalized vector size.');
  const overrides = Array.isArray(data.styleOverrideTable)
    ? data.styleOverrideTable.map(record)
    : [];
  const vertices: VectorPoint[] = Array.from({ length: nv }, () => {
    const style = uint(),
      x = float() * sx,
      y = float() * sy;
    const radius =
      number(
        overrides.find((s) => s.styleID === style)?.cornerRadius,
        number(node.cornerRadius, 0),
      ) * Math.sqrt(Math.abs(sx * sy));
    return { x, y, radius };
  });
  const edges = Array.from({ length: ns }, () => {
    const style = uint(),
      a = uint(),
      out = { x: float() * sx, y: float() * sy },
      b = uint(),
      incoming = { x: float() * sx, y: float() * sy };
    if (a >= nv || b >= nv) figError('vector network references a missing vertex.');
    return { style, a, b, out, incoming };
  });
  let indices = 0;
  for (let i = 0; i < nr; i++) {
    uint();
    const loops = uint();
    if (loops > 1000) figError('vector loop limit exceeded.');
    for (let j = 0; j < loops; j++) {
      const count = uint();
      indices += count;
      if (indices > 100000) figError('vector region limit exceeded.');
      for (let k = 0; k < count; k++)
        if (uint() >= ns) figError('vector region references a missing segment.');
    }
  }
  if (offset !== bytes.length) figError('trailing vector network data.');
  const links = Array.from({ length: nv }, () => [] as number[]);
  edges.forEach((e, i) => {
    links[e.a].push(i);
    links[e.b].push(i);
  });
  if (links.some((l) => l.length > 2) || edges.some((e) => e.style !== 0)) return null;
  const used = new Set<number>(),
    rings: FigRing[] = [];
  for (let seed = 0; seed < ns; seed++) {
    if (used.has(seed)) continue;
    let start = edges[seed].a;
    // Find an open endpoint in this component, if it has one.
    const seen = new Set<number>(),
      queue = [start];
    while (queue.length) {
      const v = queue.pop()!;
      if (seen.has(v)) continue;
      seen.add(v);
      if (links[v].length === 1) start = v;
      for (const i of links[v]) {
        const e = edges[i];
        queue.push(e.a === v ? e.b : e.a);
      }
    }
    const points: VectorPoint[] = [{ ...vertices[start] }];
    let current = start;
    while (true) {
      const index = links[current].find((i) => !used.has(i));
      if (index === undefined) break;
      used.add(index);
      const edge = edges[index],
        forward = edge.a === current,
        next = forward ? edge.b : edge.a;
      const out = forward ? edge.out : edge.incoming,
        incoming = forward ? edge.incoming : edge.out;
      if (out.x || out.y)
        points.at(-1)!.out = { x: vertices[current].x + out.x, y: vertices[current].y + out.y };
      const p = { ...vertices[next] };
      if (incoming.x || incoming.y) p.in = { x: p.x + incoming.x, y: p.y + incoming.y };
      if (next === start) {
        if (p.in) points[0].in = p.in;
        break;
      }
      points.push(p);
      current = next;
    }
    if (points.length >= 2)
      rings.push({ points, closed: current !== start ? false : links[start].length === 2 });
    // A cycle may close from a different current vertex.
    if (points.length >= 2 && links[start].length === 2) rings.at(-1)!.closed = true;
  }
  return rings;
}

export function figVector(
  node: FigRecord,
  message: FigRecord,
  world: Matrix,
  warn: Warn,
): Partial<DesignNode> | null {
  const fill =
    Array.isArray(node.fillPaints) && node.fillPaints.some((p) => record(p).visible !== false);
  const cached = Array.isArray(node.fillGeometry) ? node.fillGeometry.map(record) : [];
  let rings: FigRing[] = [],
    rule: 'nonzero' | 'evenodd' = 'evenodd';
  if (fill && cached.length) {
    for (const path of cached) {
      if (path.styleID) {
        warn('Per-region vector paint overrides are not preserved.');
      }
      rings.push(...readFigPath(figBlob(message, path.commandsBlob)));
    }
    rule = cached.every((p) => p.windingRule === 'NONZERO') ? 'nonzero' : 'evenodd';
    warn(
      'Vector fill outlines are editable Bezier paths; original vector-network topology is not retained.',
    );
  } else if (record(node.vectorData).vectorNetworkBlob !== undefined) {
    const network = readFigNetwork(
      figBlob(message, record(node.vectorData).vectorNetworkBlob),
      node,
    );
    if (network) rings = network;
    else warn('Branched stroke networks are not supported and are omitted.');
  }
  if (!rings.length) return null;
  const closed = !!fill;
  const apply = (p: Point) => ({
    x: world[0] * p.x + world[2] * p.y + world[4],
    y: world[1] * p.x + world[3] * p.y + world[5],
  });
  const mapped = rings.map((r) => {
    const points = r.points.map((p) => ({
      ...mapVectorPoint(p, apply),
      ...(p.radius !== undefined
        ? { radius: p.radius * Math.sqrt(Math.abs(world[0] * world[3] - world[1] * world[2])) }
        : {}),
    }));
    if (!closed && r.closed) {
      const first = points[0];
      const end = { ...first };
      delete end.out;
      points.push(end);
    }
    return points;
  });
  const props = vectorFromPoints(mapped, closed);
  props.vector!.fillRule = rule;
  if (Array.isArray(node.strokePaints) && node.strokePaints.length && cached.length)
    warn(
      'Vector strokes use centered editable strokes; exact cached stroke outlines are not retained.',
    );
  return { ...props, rotation: 0, flipX: false, flipY: false, radius: 0 };
}
