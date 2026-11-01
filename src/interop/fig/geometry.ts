import { figError } from './limits.ts';
export type FigRecord = Record<string, unknown>;
export function record(value: unknown): FigRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof Uint8Array)
    return {};
  return value as FigRecord;
}
export function number(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value))
    figError('invalid numeric layer property.');
  return value;
}
export function guid(value: unknown): string {
  const id = record(value);
  for (const field of ['sessionID', 'localID'])
    if (!Number.isInteger(id[field]) || Number(id[field]) < 0 || Number(id[field]) > 0xffffffff)
      figError('missing or invalid node identifier.');
  return `fig:${id.sessionID}:${id.localID}`;
}
export type Matrix = [number, number, number, number, number, number];
export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
export function matrix(value: unknown): Matrix {
  const m = record(value);
  return [
    number(m.m00, 1),
    number(m.m10, 0),
    number(m.m01, 0),
    number(m.m11, 1),
    number(m.m02, 0),
    number(m.m12, 0),
  ];
}
export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
export function geometry(n: FigRecord, m: Matrix) {
  const sx = Math.hypot(m[0], m[1]),
    sy = Math.hypot(m[2], m[3]);
  if (sx < 1e-8 || sy < 1e-8 || Math.abs((m[0] * m[2] + m[1] * m[3]) / (sx * sy)) > 1e-5)
    return null;
  const size = record(n.size),
    w = number(size.x, 0),
    h = number(size.y, 0);
  if (w <= 0 || h <= 0) return null;
  const width = w * sx,
    height = h * sy;
  return {
    x: (m[0] * w) / 2 + (m[2] * h) / 2 + m[4] - width / 2,
    y: (m[1] * w) / 2 + (m[3] * h) / 2 + m[5] - height / 2,
    width,
    height,
    rotation: (Math.atan2(m[1], m[0]) * 180) / Math.PI,
    flipY: m[0] * m[3] - m[1] * m[2] < 0,
    sx,
    sy,
  };
}
