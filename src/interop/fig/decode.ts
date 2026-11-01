import { detectContainer } from '../fig-container.ts';
import { unwrapFigZip } from './archive.ts';
import { inflateFig } from './compression.ts';
import { FIG_LIMITS, figError } from './limits.ts';
import { readFigSchema, readFigMessage } from './kiwi.ts';

export interface DecodedFig {
  container: 'fig-kiwi' | 'zip';
  version: number;
  message: Record<string, unknown>;
}
export function decodeFig(bytes: Uint8Array): DecodedFig {
  if (bytes.length > FIG_LIMITS.file) figError('file exceeds the 100 MB limit.');
  const kind = detectContainer(bytes);
  if (kind === 'unknown') figError('not a native fig-kiwi stream or .fig ZIP archive.');
  const data = kind === 'zip' ? unwrapFigZip(bytes) : bytes;
  if (detectContainer(data) !== 'fig-kiwi' || data.length < 12)
    figError('invalid or truncated fig-kiwi header.');
  if (data.length > FIG_LIMITS.canvas) figError('canvas exceeds the import limit.');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength),
    version = view.getUint32(8, true);
  if (version < 15) figError('writer versions older than 15 are not supported.');
  const chunks: Uint8Array[] = [];
  let offset = 12;
  while (offset < data.length) {
    if (offset + 4 > data.length || chunks.length >= 16)
      figError('truncated or excessive chunk headers.');
    const length = view.getUint32(offset, true);
    offset += 4;
    if (!length || offset + length > data.length) figError('invalid or truncated chunk data.');
    chunks.push(data.subarray(offset, offset + length));
    offset += length;
  }
  if (chunks.length < 2) figError('schema and document chunks are required.');
  const schema = readFigSchema(inflateFig(chunks[0], FIG_LIMITS.schema));
  const message = readFigMessage(inflateFig(chunks[1], FIG_LIMITS.message), schema);
  if (message.type !== 'NODE_CHANGES' || !Array.isArray(message.nodeChanges))
    figError('file does not contain a document snapshot.');
  return { container: kind, version, message };
}
