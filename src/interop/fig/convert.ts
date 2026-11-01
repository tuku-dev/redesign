import { createDocument, createNode, validateDocument } from '../../model/document.ts';
import type { DesignDocument, DesignNode, NodeType } from '../../model/types.ts';
import type { DecodedFig } from './decode.ts';
import { FIG_LIMITS, figError } from './limits.ts';
import { record, number, guid, matrix, multiply, geometry, IDENTITY } from './geometry.ts';
import type { FigRecord, Matrix } from './geometry.ts';
import { figPaint } from './paint.ts';

export interface FigImportReport {
  version: number;
  container: 'zip' | 'fig-kiwi';
  imported: number;
  skipped: number;
  pages: number;
  skippedTypes: string[];
  warnings: string[];
}
export interface FigImportResult {
  document: DesignDocument;
  report: FigImportReport;
}
const TYPES: Record<string, NodeType> = {
  FRAME: 'frame',
  GROUP: 'group',
  RECTANGLE: 'rectangle',
  ROUNDED_RECTANGLE: 'rectangle',
  ELLIPSE: 'ellipse',
  TEXT: 'text',
};

/** Deliberately small editable subset. Unsupported subtrees are counted, never silently flattened. */
export function convertFig(decoded: DecodedFig, name: string): FigImportResult {
  const raw = decoded.message.nodeChanges;
  if (!Array.isArray(raw) || raw.length > FIG_LIMITS.nodes + 102)
    figError('node count exceeds the import limit.');
  const nodes = new Map<string, FigRecord>(),
    children = new Map<string, FigRecord[]>();
  let root: string | undefined;
  for (const value of raw) {
    const n = record(value),
      id = guid(n.guid);
    if (nodes.has(id))
      figError('duplicate node identifiers/incremental updates are not supported.');
    if (n.phase !== undefined && n.phase !== 'CREATED')
      figError('incremental/deleted node records are not supported.');
    nodes.set(id, n);
    if (n.type === 'DOCUMENT') {
      if (root) figError('multiple document roots.');
      root = id;
    }
  }
  if (!root) figError('document root is missing.');
  for (const [id, n] of nodes) {
    if (id === root) continue;
    const parent = guid(record(n.parentIndex).guid);
    if (!nodes.has(parent)) figError('a layer references a missing parent.');
    const list = children.get(parent) ?? [];
    list.push(n);
    children.set(parent, list);
    const seen = new Set([id]);
    let cursor = parent;
    while (cursor !== root) {
      if (seen.has(cursor) || seen.size > FIG_LIMITS.depth)
        figError('cyclic or deeply nested layer hierarchy.');
      seen.add(cursor);
      const ancestor = nodes.get(cursor);
      if (!ancestor) figError('a layer references a missing ancestor.');
      cursor = guid(record(ancestor.parentIndex).guid);
    }
  }
  for (const list of children.values())
    list.sort((a, b) => {
      const p = String(record(a.parentIndex).position ?? ''),
        q = String(record(b.parentIndex).position ?? '');
      return p < q ? -1 : p > q ? 1 : 0;
    });
  const warnings = new Set<string>(),
    skippedTypes = new Set<string>();
  const warn = (message: string) => warnings.add(message);
  if (![48, 106].includes(decoded.version))
    warn('This writer version has not been checked against the bundled fixtures.');
  let imported = 0,
    skipped = 0;
  const doc = createDocument();
  doc.name = name;
  const pages: { id: string; name: string; nodes: DesignNode[] }[] = [];
  function skip(n: FigRecord): void {
    skipped++;
    skippedTypes.add(String(n.type ?? 'UNKNOWN'));
    for (const child of children.get(guid(n.guid)) ?? []) skip(child);
  }
  function visit(n: FigRecord, parentId: string | null, world: Matrix, target: DesignNode[]): void {
    const typeName = String(n.type),
      type = Object.hasOwn(TYPES, typeName) ? TYPES[typeName] : undefined;
    if (!type) {
      skip(n);
      return;
    }
    const m = multiply(world, matrix(n.transform)),
      box = geometry(n, m);
    if (!box) {
      warn('Zero-sized, singular or sheared layers and their children are omitted.');
      skip(n);
      return;
    }
    const { sx, sy, ...bounds } = box,
      scale = Math.sqrt(sx * sy);
    if (type === 'text' && (Math.abs(sx - sy) > 1e-5 || bounds.flipY))
      warn('Nonuniform or reflected text transforms may render differently.');
    const radius = number(n.cornerRadius, 0) * scale;
    const node = createNode(type, {
      ...bounds,
      ...figPaint(n, scale, warn),
      id: guid(n.guid),
      parentId,
      name: typeof n.name === 'string' && n.name ? n.name : typeName,
      hidden: n.visible === false,
      locked: n.locked === true,
      radius,
      clipContent: type === 'frame' && n.frameMaskDisabled !== true,
    });
    if (type === 'rectangle' || type === 'frame') {
      node.cornerRadii = {
        topLeft: number(n.rectangleTopLeftCornerRadius, number(n.cornerRadius, 0)) * scale,
        topRight: number(n.rectangleTopRightCornerRadius, number(n.cornerRadius, 0)) * scale,
        bottomRight: number(n.rectangleBottomRightCornerRadius, number(n.cornerRadius, 0)) * scale,
        bottomLeft: number(n.rectangleBottomLeftCornerRadius, number(n.cornerRadius, 0)) * scale,
      };
      if (number(n.cornerSmoothing, 0))
        warn('Figma corner smoothing is approximated by circular corners.');
    }
    if (n.stackMode && n.stackMode !== 'NONE')
      warn('Auto layout is imported at fixed positions without responsive layout rules.');
    if (type === 'ellipse' && n.arcData) warn('Ellipse arc settings are omitted.');
    if (type === 'text') {
      warn(
        'Text uses a single style and installed fonts; rich text, shaping and font fidelity are not verified.',
      );
      const data = record(n.textData),
        font = record(n.fontName),
        size = number(n.fontSize, 12) * scale;
      const meta = Array.isArray(data.fontMetaData) ? record(data.fontMetaData[0]) : {};
      node.text = typeof data.characters === 'string' ? data.characters : '';
      node.fontSize = size;
      node.fontFamily = typeof font.family === 'string' && font.family ? font.family : 'Inter';
      node.fontWeight = Math.max(100, Math.min(900, number(meta.fontWeight, 400)));
      node.fontStyle = /italic|oblique/i.test(String(font.style)) ? 'italic' : 'normal';
      const line = record(n.lineHeight),
        spacing = record(n.letterSpacing);
      node.lineHeight =
        line.units === 'PIXELS'
          ? (number(line.value, (size / scale) * 1.2) * scale) / size
          : number(line.value, 120) / 100;
      node.letterSpacing =
        spacing.units === 'PERCENT'
          ? (number(spacing.value, 0) / 100) * size
          : number(spacing.value, 0) * scale;
      node.textAlign =
        n.textAlignHorizontal === 'CENTER'
          ? 'center'
          : n.textAlignHorizontal === 'RIGHT'
            ? 'right'
            : 'left';
      node.textWrap = 'word';
      if (n.textAlignVertical && n.textAlignVertical !== 'TOP')
        warn('Vertical text alignment is approximated by top alignment.');
    }
    target.push(node);
    imported++;
    const list = children.get(node.id) ?? [];
    if (list.length && type !== 'frame' && type !== 'group')
      figError('children attached to a non-container layer.');
    for (const child of list) visit(child, node.id, m, target);
  }
  for (const page of children.get(root) ?? []) {
    if (page.type !== 'CANVAS') {
      warn('Non-page document metadata nodes are omitted.');
      continue;
    }
    if (page.internalOnly === true) continue;
    if (pages.length >= 100) figError('more than 100 pages.');
    const id = guid(page.guid),
      target: DesignNode[] = [];
    for (const child of children.get(id) ?? []) visit(child, null, IDENTITY, target);
    pages.push({
      id,
      name: typeof page.name === 'string' && page.name ? page.name : 'Page ' + (pages.length + 1),
      nodes: target,
    });
  }
  if (!pages.length) figError('no public Figma Design pages were found.');
  if (imported > FIG_LIMITS.nodes) figError('more than 10000 editable layers.');
  if (!imported && skipped)
    figError('no supported editable layers; this file contains only unsupported content.');
  doc.nodes = pages[0].nodes;
  doc.workspace = {
    activePageId: pages[0].id,
    pages: pages.map((p, i) => ({ ...p, nodes: i ? p.nodes : [] })),
    rulers: false,
    guidesVisible: true,
    guides: [],
  };
  return {
    document: validateDocument(doc),
    report: {
      version: decoded.version,
      container: decoded.container,
      imported,
      skipped,
      pages: pages.length,
      skippedTypes: [...skippedTypes].sort(),
      warnings: [...warnings],
    },
  };
}
