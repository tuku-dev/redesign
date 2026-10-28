export type SvgAttributes = Record<string, string | number>;
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: SvgAttributes = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}
