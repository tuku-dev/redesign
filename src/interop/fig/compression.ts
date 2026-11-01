import { Inflate } from 'fflate';
import { Decompress } from 'fzstd';
import { figError } from './limits.ts';

/** Inspect frame boundaries and window sizes before fzstd allocates its history buffer. */
function checkZstd(data: Uint8Array, limit: number): void {
  if (data.length < 6) figError('truncated Zstandard frame.');
  const flag = data[4],
    single = !!(flag & 32),
    sizeFlag = flag >>> 6;
  if (flag & 8) figError('invalid Zstandard frame.');
  let pos = single ? 5 : 6;
  const dictBytes = [0, 1, 2, 4][flag & 3];
  if (pos + dictBytes > data.length) figError('truncated Zstandard dictionary.');
  if (data.subarray(pos, pos + dictBytes).some((b) => b !== 0))
    figError('Zstandard dictionaries are not supported.');
  pos += dictBytes;
  const sizeBytes = sizeFlag ? 1 << sizeFlag : single ? 1 : 0;
  if (pos + sizeBytes > data.length) figError('truncated Zstandard size.');
  let size = 0n;
  for (let i = 0; i < sizeBytes; i++) size |= BigInt(data[pos++]) << BigInt(i * 8);
  if (sizeFlag === 1) size += 256n;
  const windowBase = 2 ** (10 + (data[5] >>> 3));
  const window = single ? size : BigInt(windowBase + (windowBase / 8) * (data[5] & 7));
  if (size > BigInt(limit) || window > BigInt(limit))
    figError('Zstandard output/window exceeds the import limit.');
  let last = false;
  while (!last) {
    if (pos + 3 > data.length) figError('truncated Zstandard block.');
    const header = data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16);
    pos += 3;
    last = !!(header & 1);
    const type = (header >>> 1) & 3,
      length = header >>> 3;
    if (type === 3 || length > 131072) figError('invalid Zstandard block.');
    pos += type === 1 ? 1 : length;
    if (pos > data.length) figError('truncated Zstandard block data.');
  }
  if (flag & 4) pos += 4;
  if (pos !== data.length) figError('trailing or concatenated Zstandard frames are not supported.');
}

export function inflateFig(
  data: Uint8Array,
  limit: number,
  codec: 'auto' | 'deflate' = 'auto',
): Uint8Array {
  const parts: Uint8Array[] = [];
  let size = 0;
  const collect = (part: Uint8Array) => {
    size += part.length;
    if (size > limit) figError('decompressed data exceeds the import limit.');
    parts.push(part.slice());
  };
  const zstd =
    codec === 'auto' &&
    data[0] === 0x28 &&
    data[1] === 0xb5 &&
    data[2] === 0x2f &&
    data[3] === 0xfd;
  if (zstd) checkZstd(data, limit);
  const stream = zstd ? new Decompress(collect) : new Inflate(collect);
  // Small compressed pushes bound transient DEFLATE output before collect can reject it.
  for (let i = 0; i < data.length; i += 512)
    stream.push(data.subarray(i, i + 512), i + 512 >= data.length);
  if (!data.length) figError('empty compressed chunk.');
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}
