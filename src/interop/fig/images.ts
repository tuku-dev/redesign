import type { ImageFill } from '../../model/features.ts';
import { record, number } from './geometry.ts';
import type { FigRecord } from './geometry.ts';
import type { Warn } from './paint.ts';

function raster(bytes: Uint8Array): { mime: string; width: number; height: number } | null {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.length >= 24 &&
    bytes[0] === 137 &&
    String.fromCharCode(...bytes.subarray(1, 4)) === 'PNG'
  )
    return { mime: 'image/png', width: v.getUint32(16), height: v.getUint32(20) };
  if (bytes.length >= 10 && String.fromCharCode(...bytes.subarray(0, 3)) === 'GIF')
    return { mime: 'image/gif', width: v.getUint16(6, true), height: v.getUint16(8, true) };
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let p = 2;
    while (p + 4 <= bytes.length) {
      if (bytes[p++] !== 255) break;
      while (bytes[p] === 255) p++;
      const marker = bytes[p++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const size = v.getUint16(p);
      if (size < 2 || p + size > bytes.length) break;
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker,
        ) &&
        size >= 7
      )
        return { mime: 'image/jpeg', width: v.getUint16(p + 5), height: v.getUint16(p + 3) };
      p += size;
    }
  }
  if (
    bytes.length >= 30 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  ) {
    const kind = String.fromCharCode(...bytes.subarray(12, 16));
    if (kind === 'VP8X')
      return {
        mime: 'image/webp',
        width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
      };
    if (kind === 'VP8 ')
      return {
        mime: 'image/webp',
        width: v.getUint16(26, true) & 0x3fff,
        height: v.getUint16(28, true) & 0x3fff,
      };
    if (kind === 'VP8L' && bytes[20] === 0x2f) {
      const bits = v.getUint32(21, true);
      return {
        mime: 'image/webp',
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >>> 14) & 0x3fff),
      };
    }
  }
  return null;
}
function dataUrl(bytes: Uint8Array, mime: string): string {
  // btoa exists in browsers and supported Node; avoid argument-size limits on large images.
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:${mime};base64,${btoa(binary)}`;
}
export function figImage(
  n: FigRecord,
  images: Map<string, Uint8Array>,
  warn: Warn,
): ImageFill | null {
  const paints = Array.isArray(n.fillPaints)
    ? n.fillPaints.map(record).filter((p) => p.visible !== false)
    : [];
  const paint = paints.find((p) => p.type === 'IMAGE');
  if (!paint) return null;
  if (paints.length > 1)
    warn('Image layers retain one image paint; additional fills may render differently.');
  const hash = record(paint.image).hash;
  const key =
    hash instanceof Uint8Array && hash.length === 20
      ? [...hash].map((n) => n.toString(16).padStart(2, '0')).join('')
      : '';
  const bytes = images.get(key);
  if (!bytes) {
    warn('A referenced embedded image is missing and its paint is omitted.');
    return null;
  }
  const info = raster(bytes);
  if (
    !info ||
    !info.width ||
    !info.height ||
    info.width > 100000 ||
    info.height > 100000 ||
    info.width * info.height > 40_000_000
  ) {
    warn('An unsupported or excessively large raster image is omitted.');
    return null;
  }
  const mode = paint.imageScaleMode;
  if (mode === 'TILE') {
    warn('Tiled image paints are not supported and are omitted.');
    return null;
  }
  const transform = record(paint.transform);
  if (
    number(transform.m00, 1) !== 1 ||
    number(transform.m11, 1) !== 1 ||
    number(transform.m01, 0) ||
    number(transform.m10, 0) ||
    number(transform.m02, 0) ||
    number(transform.m12, 0) ||
    number(paint.rotation, 0)
  )
    warn('Custom image transforms/crops are approximated by centered image fitting.');
  if (paint.filters) warn('Native image filters are not preserved.');
  return {
    src: dataUrl(bytes, info.mime),
    fit: mode === 'FIT' ? 'contain' : mode === 'STRETCH' ? 'stretch' : 'cover',
    focalX: 0.5,
    focalY: 0.5,
    naturalWidth: info.width,
    naturalHeight: info.height,
    opacity: Math.max(0, Math.min(1, number(paint.opacity, 1))),
  };
}
