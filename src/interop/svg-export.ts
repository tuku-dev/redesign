import type { DesignDocument } from '../model/types.ts';
import { documentVisualBounds } from '../model/render-bounds.ts';
import { svg } from '../render/svg.ts';
import { renderDocument } from '../render/document.ts';
export function exportSvg(doc: DesignDocument): string | null {
  const box = documentVisualBounds(doc);
  if (!box) return null;
  const out = svg('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `${box.x} ${box.y} ${box.width} ${box.height}`,
    width: box.width,
    height: box.height,
  });
  out.append(...renderDocument(doc));
  out.querySelectorAll('[data-id]').forEach((n) => n.removeAttribute('data-id'));
  return new XMLSerializer().serializeToString(out);
}
