import { validFeatures } from './features.ts';
import { validateWorkspace } from './workspace-validation.ts';
import { nodeOptions, validNodeOptions } from './node-options.ts';
import type { NodeOptions } from './types.ts';
import { assertHierarchy, containsBox } from './hierarchy.ts';
import { clone } from './types.ts';
import type { DesignDocument, DesignNode, NodeType } from './types.ts';
export function createNode(type: NodeType, props: Partial<DesignNode> = {}): DesignNode {
  return {
    id: crypto.randomUUID(),
    parentId: null,
    locked: false,
    hidden: false,
    type,
    name: type[0].toUpperCase() + type.slice(1),
    x: 0,
    y: 0,
    width: 160,
    height: 120,
    fill: type === 'frame' ? '#ffffff' : type === 'text' ? '#000000' : '#d9d9d9',
    opacity: 1,
    radius: 0,
    text: 'Your text',
    fontSize: 28,
    ...nodeOptions({ clipContent: type === 'frame' }),
    ...props,
  };
}
export function createDocument(): DesignDocument {
  return { format: 'redesign', version: 1, name: 'Untitled', nodes: [] };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
type ImportedNode = Omit<DesignNode, 'parentId' | 'locked' | 'hidden' | keyof NodeOptions> &
  Partial<NodeOptions> & {
    parentId?: string | null;
    locked?: boolean;
    hidden?: boolean;
  };
function isNode(value: unknown): value is ImportedNode {
  if (
    !record(value) ||
    !validNodeOptions(value) ||
    !validFeatures(value) ||
    typeof value.type !== 'string' ||
    !['frame', 'rectangle', 'ellipse', 'text', 'group', 'path'].includes(value.type) ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    (value.parentId !== undefined &&
      value.parentId !== null &&
      (typeof value.parentId !== 'string' || value.parentId.length === 0)) ||
    (value.locked !== undefined && typeof value.locked !== 'boolean') ||
    (value.hidden !== undefined && typeof value.hidden !== 'boolean') ||
    typeof value.name !== 'string' ||
    typeof value.text !== 'string' ||
    typeof value.fill !== 'string' ||
    !/^#[0-9a-f]{6}$/i.test(value.fill)
  )
    return false;
  for (const key of ['x', 'y', 'width', 'height', 'radius', 'opacity', 'fontSize']) {
    const n = value[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 1000000) return false;
  }
  const radii = value.cornerRadii;
  if (radii !== undefined) {
    if (!['frame', 'rectangle'].includes(String(value.type)) || !record(radii)) return false;
    if (
      !['topLeft', 'topRight', 'bottomRight', 'bottomLeft'].every((key) => {
        const radius = radii[key];
        return (
          typeof radius === 'number' && Number.isFinite(radius) && radius >= 0 && radius <= 1e6
        );
      })
    )
      return false;
  }
  return (
    Number(value.width) >= 1 &&
    Number(value.height) >= 1 &&
    Number(value.radius) >= 0 &&
    Number(value.fontSize) >= 1 &&
    Number(value.opacity) >= 0 &&
    Number(value.opacity) <= 1
  );
}
export function validateDocument(value: unknown): DesignDocument {
  if (
    !record(value) ||
    value.format !== 'redesign' ||
    value.version !== 1 ||
    typeof value.name !== 'string' ||
    !Array.isArray(value.nodes) ||
    value.nodes.length > 10000
  )
    throw new Error('Unsupported reDesign document.');
  const nodes: DesignNode[] = [];
  const ids = new Set<string>();
  const legacy = new Set<string>();
  for (const node of value.nodes as unknown[]) {
    if (!isNode(node) || ids.has(node.id)) throw new Error('Invalid layer data or geometry.');
    ids.add(node.id);
    if (node.parentId === undefined) legacy.add(node.id);
    nodes.push({
      ...clone(node),
      ...nodeOptions(node),
      parentId: node.parentId ?? null,
      locked: node.locked ?? false,
      hidden: node.hidden ?? false,
    });
  }
  // Old flat version-1 documents gain parents only for fully enclosed legacy layers.
  // Strictly larger frames avoid ambiguous equal-size frame cycles.
  for (const n of nodes)
    if (legacy.has(n.id)) {
      const candidates = nodes.filter(
        (f) =>
          f.type === 'frame' &&
          f.id !== n.id &&
          f.width * f.height > n.width * n.height &&
          containsBox(f, n),
      );
      candidates.sort((a, b) => a.width * a.height - b.width * b.height);
      n.parentId = candidates[0]?.id ?? null;
    }
  assertHierarchy(nodes);
  const doc: DesignDocument = { format: 'redesign', version: 1, name: value.name, nodes };
  if (value.workspace !== undefined) doc.workspace = validateWorkspace(value.workspace, nodes);
  return doc;
}
