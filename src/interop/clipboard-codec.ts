import { detachedCopy } from '../model/hierarchy.ts';
import type { DesignNode } from '../model/types.ts';
import { validateDocument } from '../model/document.ts';
const MAX_LENGTH = 20 * 1024 * 1024;
export function encodeClipboard(nodes: readonly DesignNode[]): string {
  const payload = { format: 'redesign-clipboard', version: 1, nodes: detachedCopy(nodes) };
  return JSON.stringify(payload);
}
export function decodeClipboard(text: string): DesignNode[] {
  if (typeof text !== 'string' || text.length > MAX_LENGTH)
    throw new Error('Clipboard is too large.');
  const value: unknown = JSON.parse(text);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('format' in value) ||
    value.format !== 'redesign-clipboard' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('nodes' in value)
  )
    throw new Error('Clipboard does not contain reDesign layers.');
  return validateDocument({ format: 'redesign', version: 1, name: 'Clipboard', nodes: value.nodes })
    .nodes;
}
