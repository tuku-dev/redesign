import type { NodeOptions } from './types.ts';
export const DEFAULT_OPTIONS = {
  rotation: 0,
  clipContent: false,
  constraintX: 'start',
  constraintY: 'start',
  fontFamily: 'Arial',
  fontWeight: 400,
  fontStyle: 'normal',
  lineHeight: 1.2,
  letterSpacing: 0,
  textAlign: 'left',
  textWrap: 'none',
} as const;
export function nodeOptions(value: Partial<NodeOptions> = {}): NodeOptions {
  return {
    rotation: value.rotation ?? 0,
    clipContent: value.clipContent ?? false,
    constraintX: value.constraintX ?? 'start',
    constraintY: value.constraintY ?? 'start',
    fontFamily: value.fontFamily ?? 'Arial',
    fontWeight: value.fontWeight ?? 400,
    fontStyle: value.fontStyle ?? 'normal',
    lineHeight: value.lineHeight ?? 1.2,
    letterSpacing: value.letterSpacing ?? 0,
    textAlign: value.textAlign ?? 'left',
    textWrap: value.textWrap ?? 'none',
  };
}
export function validNodeOptions(value: Record<string, unknown>): boolean {
  const numeric: Record<string, readonly [number, number]> = {
    rotation: [-1000000, 1000000],
    fontWeight: [100, 900],
    lineHeight: [0.5, 10],
    letterSpacing: [-10000, 10000],
  };
  for (const [key, [min, max]] of Object.entries(numeric)) {
    const n = value[key];
    if (n !== undefined && (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max))
      return false;
  }
  if (value.clipContent !== undefined && typeof value.clipContent !== 'boolean') return false;
  if (
    value.fontFamily !== undefined &&
    (typeof value.fontFamily !== 'string' ||
      !value.fontFamily.trim() ||
      value.fontFamily.length > 256)
  )
    return false;
  const enums: Record<string, readonly string[]> = {
    constraintX: ['start', 'end', 'center', 'stretch', 'scale'],
    constraintY: ['start', 'end', 'center', 'stretch', 'scale'],
    fontStyle: ['normal', 'italic'],
    textAlign: ['left', 'center', 'right'],
    textWrap: ['none', 'word'],
  };
  return Object.entries(enums).every(
    ([key, options]) =>
      value[key] === undefined || (typeof value[key] === 'string' && options.includes(value[key])),
  );
}
