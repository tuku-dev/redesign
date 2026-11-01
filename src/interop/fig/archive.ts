import { inflateFig } from './compression.ts';
import { FIG_LIMITS, figError } from './limits.ts';

const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  for (let j = 0; j < 8; j++) i = i & 1 ? 0xedb88320 ^ (i >>> 1) : i >>> 1;
  return i >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Read central-directory sizes, including archives whose local sizes use descriptors. */
export function unwrapFigZip(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) {
    if (
      view.getUint32(p, true) === 0x06054b50 &&
      p + 22 + view.getUint16(p + 20, true) === bytes.length
    ) {
      eocd = p;
      break;
    }
  }
  if (eocd < 0) figError('invalid or truncated ZIP directory.');
  const count = view.getUint16(eocd + 10, true),
    start = view.getUint32(eocd + 16, true),
    size = view.getUint32(eocd + 12, true);
  if (
    view.getUint16(eocd + 4, true) ||
    view.getUint16(eocd + 6, true) ||
    view.getUint16(eocd + 8, true) !== count ||
    count === 65535 ||
    start === 0xffffffff ||
    size === 0xffffffff
  )
    figError('split/ZIP64 archives are not supported.');
  if (count > FIG_LIMITS.entries || start + size !== eocd)
    figError('ZIP directory exceeds limits or has invalid bounds.');
  const names = new Set<string>();
  let pos = start,
    total = 0,
    canvas: Uint8Array | undefined;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > eocd || view.getUint32(pos, true) !== 0x02014b50) figError('invalid ZIP entry.');
    const flags = view.getUint16(pos + 8, true),
      method = view.getUint16(pos + 10, true),
      crc = view.getUint32(pos + 16, true),
      packed = view.getUint32(pos + 20, true),
      unpacked = view.getUint32(pos + 24, true);
    const nameLength = view.getUint16(pos + 28, true),
      extra = view.getUint16(pos + 30, true),
      comment = view.getUint16(pos + 32, true),
      local = view.getUint32(pos + 42, true);
    const end = pos + 46 + nameLength + extra + comment;
    if (end > eocd || local + 30 > start || flags & 1 || view.getUint16(pos + 34, true))
      figError('invalid or encrypted ZIP entry.');
    const nameBytes = bytes.subarray(pos + 46, pos + 46 + nameLength);
    const name = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
    if (
      !name ||
      name.includes('\\') ||
      name.startsWith('/') ||
      name.includes('\0') ||
      name.split('/').some((p) => p === '..' || p === '.') ||
      names.has(name)
    )
      figError('unsafe or duplicate ZIP entry name.');
    names.add(name);
    total += unpacked;
    if (total > FIG_LIMITS.archive || packed === 0xffffffff || unpacked === 0xffffffff)
      figError('ZIP expansion exceeds the import limit.');
    if (
      view.getUint32(local, true) !== 0x04034b50 ||
      view.getUint16(local + 8, true) !== method ||
      view.getUint16(local + 6, true) !== flags
    )
      figError('inconsistent ZIP entry header.');
    const localNameLength = view.getUint16(local + 26, true),
      localExtra = view.getUint16(local + 28, true),
      dataStart = local + 30 + localNameLength + localExtra;
    if (
      dataStart + packed > start ||
      localNameLength !== nameLength ||
      !bytes.subarray(local + 30, local + 30 + localNameLength).every((b, k) => b === nameBytes[k])
    )
      figError('invalid ZIP entry bounds/name.');
    if (name === 'canvas.fig') {
      if (unpacked > FIG_LIMITS.canvas || !unpacked)
        figError('canvas.fig exceeds the import limit or is empty.');
      const data = bytes.subarray(dataStart, dataStart + packed);
      if (method !== 0 && method !== 8) figError('unsupported ZIP compression.');
      canvas =
        method === 0 ? data : inflateFig(data, Math.min(unpacked, FIG_LIMITS.canvas), 'deflate');
      if (canvas.length !== unpacked || crc32(canvas) !== crc)
        figError('canvas.fig has an invalid size or checksum.');
    }
    pos = end;
  }
  if (pos !== eocd || !canvas) figError('ZIP archive is missing a root canvas.fig.');
  return canvas;
}
