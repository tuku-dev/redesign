import type { DesignNode } from './types.ts';
export type MeasureText = (text: string) => number;
export function graphemes(text: string): string[] {
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(
    (segment) => segment.segment,
  );
}
export function wrapText(text: string, width: number, measure: MeasureText): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const token of paragraph.split(/(\s+)/u).filter(Boolean)) {
      if (measure(line + token) <= width) {
        line += token;
        continue;
      }
      if (line.trim()) {
        lines.push(line.trimEnd());
        line = '';
      }
      if (!token.trim()) continue;
      if (measure(token) <= width) {
        line = token;
        continue;
      }
      for (const char of graphemes(token)) {
        if (line && measure(line + char) > width) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
export function textLines(node: DesignNode, measure: MeasureText): string[] {
  return node.textWrap === 'word'
    ? wrapText(node.text, node.width, measure)
    : node.text.split('\n');
}
