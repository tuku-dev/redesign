import type { DesignNode } from '../model/types.ts';
import { graphemes, textLines } from '../model/text-layout.ts';
import { svg } from './svg.ts';
let context: CanvasRenderingContext2D | null | undefined;
export function measureText(node: DesignNode, text: string): number {
  if (context === undefined)
    context =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (context)
    context.font = `${node.fontStyle} ${node.fontWeight} ${node.fontSize}px ${JSON.stringify(node.fontFamily)}`;
  return (
    (context ? context.measureText(text).width : graphemes(text).length * node.fontSize * 0.6) +
    Math.max(0, graphemes(text).length - 1) * node.letterSpacing
  );
}
export function renderText(
  node: DesignNode,
  attrs: Record<string, string | number>,
): SVGTextElement {
  const x =
    node.x +
    (node.textAlign === 'center' ? node.width / 2 : node.textAlign === 'right' ? node.width : 0);
  const text = svg('text', {
    ...attrs,
    x,
    y: node.y,
    'font-size': node.fontSize,
    'font-family': node.fontFamily,
    'font-weight': node.fontWeight,
    'font-style': node.fontStyle,
    'letter-spacing': node.letterSpacing,
    'text-anchor':
      node.textAlign === 'center' ? 'middle' : node.textAlign === 'right' ? 'end' : 'start',
    'dominant-baseline': 'text-before-edge',
  });
  text.style.whiteSpace = 'pre';
  for (const [i, line] of textLines(node, (t) => measureText(node, t)).entries()) {
    const span = svg('tspan', { x, dy: i ? node.fontSize * node.lineHeight : 0 });
    span.textContent = line || '\u200b';
    text.append(span);
  }
  return text;
}
