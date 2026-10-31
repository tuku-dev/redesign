export type BinaryContainer = 'fig-kiwi' | 'zip' | 'unknown';

const FIG_MAGIC = [0x66, 0x69, 0x67, 0x2d, 0x6b, 0x69, 0x77, 0x69]; // "fig-kiwi"
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04"

const startsWith = (bytes: Uint8Array, magic: number[]) =>
  bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b);

export function detectContainer(head: Uint8Array): BinaryContainer {
  if (startsWith(head, FIG_MAGIC)) return 'fig-kiwi';
  if (startsWith(head, ZIP_MAGIC)) return 'zip';
  return 'unknown';
}

export async function rejectBinaryDocument(file: File): Promise<void> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const kind = detectContainer(head);
  const isFigName = /\.fig$/i.test(file.name);
  if (kind === 'unknown' && !isFigName) return;
  throw new Error(
    'Figma .fig files are not supported yet. Open a .redesign file instead.',
  );
}
