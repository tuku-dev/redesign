import type { DesignNode } from '../model/types.ts';
import { graphemes, textLines } from '../model/text-layout.ts';
import { textPathData } from '../model/vector.ts';
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
export function renderText(node: DesignNode, attrs: Record<string, string | number>): SVGElement {
  if (node.textPath) return renderTextOnPath(node, attrs);
  return renderFlatText(node, attrs);
}
let pathSequence = 0;
/** Glyphs follow the stored curve; a transparent stroke keeps the layer clickable. */
function renderTextOnPath(node: DesignNode, attrs: Record<string, string | number>): SVGElement {
  const id = `text-path-${pathSequence++}`,
    d = textPathData(node),
    group = svg('g', attrs),
    defs = svg('defs'),
    align = node.textAlign;
  defs.append(svg('path', { id, d, fill: 'none' }));
  const text = svg('text', {
    'font-size': node.fontSize,
    'font-family': node.fontFamily,
    'font-weight': node.fontWeight,
    'font-style': node.fontStyle,
    'letter-spacing': node.letterSpacing,
    'text-anchor': align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start',
  });
  text.style.whiteSpace = 'pre';
  const run = svg('textPath', {
    href: `#${id}`,
    startOffset: align === 'center' ? '50%' : align === 'right' ? '100%' : '0%',
  });
  run.textContent = node.text.replace(/\s*\n\s*/g, ' ') || '\u200b';
  text.append(run);
  group.append(
    defs,
    svg('path', {
      d,
      fill: 'none',
      stroke: 'transparent',
      'stroke-width': Math.max(node.fontSize, 12),
      'pointer-events': 'stroke',
      'data-id': node.id,
    }),
    text,
  );
  return group;
}
function renderFlatText(node: DesignNode, attrs: Record<string, string | number>): SVGTextElement {
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
