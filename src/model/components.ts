import type { DesignDocument, DesignNode } from './types.ts';
import { clone } from './types.ts';
import { descendants } from './hierarchy.ts';
import { allNodes } from './workspace.ts';
import { center, localPoint, transformNodePoint } from './rotation.ts';
const inherited = [
  'name',
  'fill',
  'opacity',
  'radius',
  'cornerRadii',
  'text',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textWrap',
  'clipContent',
  'constraintX',
  'constraintY',
  'appearance',
  'image',
  'vector',
  'layout',
  'sizing',
  'layoutGrid',
  'prototype',
  'width',
  'height',
  'rotation',
  'flipX',
  'flipY',
  'hidden',
] as const;
function records(doc: DesignDocument): { nodes: DesignNode[] }[] {
  return [doc, ...(doc.workspace?.pages ?? [])];
}
export function detachInstance(doc: DesignDocument, root: DesignNode): void {
  for (const n of descendants(doc, new Set([root.id]))) {
    delete n.instanceSource;
    delete n.overrides;
  }
  delete root.component;
}
export function syncComponents(doc: DesignDocument, before?: DesignDocument): void {
  const sources = allNodes(doc),
    old = before ? new Map(allNodes(before).map((n) => [n.id, n])) : new Map<string, DesignNode>();
  for (const page of records(doc)) {
    for (const root of [...page.nodes].filter((n) => n.component?.kind === 'instance')) {
      const source = sources.find(
        (n) => n.id === root.component?.sourceId && n.component?.kind === 'main',
      );
      const local = { ...doc, nodes: page.nodes };
      if (!source) {
        detachInstance(local, root);
        continue;
      }
      const sourcePage = records(doc).find((p) => p.nodes.includes(source))!;
      const templates = descendants({ ...doc, nodes: sourcePage.nodes }, new Set([source.id]));
      const templateIds = new Set(templates.map((n) => n.id));
      const existing = descendants(local, new Set([root.id]));
      const oldRoot = old.get(root.id);
      const mapping = new Map<string, string>([[source.id, root.id]]);
      for (const n of existing) if (n.instanceSource) mapping.set(n.instanceSource, n.id);
      for (const n of templates) if (!mapping.has(n.id)) mapping.set(n.id, crypto.randomUUID());
      for (const n of existing) {
        const prev = old.get(n.id);
        if (!prev) continue;
        const overrides = new Set(n.overrides ?? []);
        for (const key of inherited) {
          if (n === root && ['rotation', 'flipX', 'flipY'].includes(key)) continue;
          if (['rotation', 'flipX', 'flipY'].includes(key) && oldRoot && oldRoot[key] !== root[key])
            continue;
          if (JSON.stringify(n[key]) !== JSON.stringify(prev[key])) overrides.add(key);
        }
        if (
          n !== root &&
          oldRoot &&
          oldRoot.x === root.x &&
          oldRoot.y === root.y &&
          oldRoot.rotation === root.rotation &&
          oldRoot.flipX === root.flipX &&
          oldRoot.flipY === root.flipY
        ) {
          if (n.x !== prev.x) overrides.add('x');
          if (n.y !== prev.y) overrides.add('y');
        }
        n.overrides = [...overrides];
      }
      const byId = new Map(existing.map((n) => [n.id, n]));
      const scaleX = root.overrides?.includes('width') ? root.width / source.width : 1;
      const scaleY = root.overrides?.includes('height') ? root.height / source.height : 1;
      for (const template of templates) {
        const id = mapping.get(template.id)!;
        let target = byId.get(id);
        if (!target) {
          target = { ...clone(template), id, instanceSource: template.id, overrides: [] };
          delete target.component;
          page.nodes.push(target);
        }
        const overrides = new Set(target.overrides ?? []);
        const record = target as unknown as Record<string, unknown>;
        for (const key of inherited) {
          if (target === root && ['rotation', 'flipX', 'flipY'].includes(key)) continue;
          if (!overrides.has(key)) {
            if (template[key] === undefined) delete record[key];
            else record[key] = clone(template[key]);
          }
        }
        if (target !== root) {
          target.parentId = mapping.get(template.parentId!) ?? root.id;
          const srcCenter = localPoint(center(template), source);
          const p = transformNodePoint(
            {
              x: root.x + (srcCenter.x - source.x) * scaleX,
              y: root.y + (srcCenter.y - source.y) * scaleY,
            },
            root,
          );
          if (!overrides.has('x')) target.x = p.x - (template.width * scaleX) / 2;
          if (!overrides.has('y')) target.y = p.y - (template.height * scaleY) / 2;
          if (!overrides.has('width')) target.width = template.width * scaleX;
          if (!overrides.has('height')) target.height = template.height * scaleY;
          if (!overrides.has('rotation'))
            target.rotation = template.rotation - source.rotation + root.rotation;
        }
      }
      const removed = new Set(
        existing
          .filter((n) => n !== root && n.instanceSource && !templateIds.has(n.instanceSource))
          .map((n) => n.id),
      );
      const removeTree = descendants({ ...doc, nodes: page.nodes }, removed);
      const removeIds = new Set(removeTree.map((n) => n.id));
      page.nodes = page.nodes.filter((n) => !removeIds.has(n.id));
      if (page === doc) doc.nodes = page.nodes;
    }
  }
}
