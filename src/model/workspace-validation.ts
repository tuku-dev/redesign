import { validateDocument } from './document.ts';
import type { DesignNode } from './types.ts';
import type { Workspace } from './features.ts';
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export function validateWorkspace(value: unknown, active: DesignNode[]): Workspace {
  const fail = () => {
    throw new Error('Invalid pages or guides.');
  };
  if (
    !object(value) ||
    typeof value.activePageId !== 'string' ||
    !Array.isArray(value.pages) ||
    !value.pages.length ||
    value.pages.length > 100 ||
    !Array.isArray(value.guides) ||
    value.guides.length > 1000 ||
    typeof value.rulers !== 'boolean' ||
    typeof value.guidesVisible !== 'boolean'
  )
    return fail();
  const ids = new Set<string>();
  const pages = value.pages.map((p) => {
    if (
      !object(p) ||
      typeof p.id !== 'string' ||
      !p.id ||
      ids.has(p.id) ||
      typeof p.name !== 'string' ||
      !p.name.trim() ||
      !Array.isArray(p.nodes) ||
      (p.id === value.activePageId && p.nodes.length)
    )
      return fail();
    ids.add(p.id);
    return {
      id: p.id,
      name: p.name,
      nodes: validateDocument({ format: 'redesign', version: 1, name: p.name, nodes: p.nodes })
        .nodes,
    };
  });
  if (!ids.has(value.activePageId)) return fail();
  const nodes = [...active, ...pages.flatMap((p) => p.nodes)],
    nodeIds = new Set(nodes.map((n) => n.id));
  if (nodes.length > 10000 || nodeIds.size !== nodes.length) return fail();
  const guideIds = new Set<string>();
  const guides = value.guides.map((g) => {
    if (
      !object(g) ||
      typeof g.id !== 'string' ||
      !g.id ||
      guideIds.has(g.id) ||
      (g.axis !== 'x' && g.axis !== 'y') ||
      typeof g.position !== 'number' ||
      !Number.isFinite(g.position) ||
      Math.abs(g.position) > 1e6
    )
      return fail();
    guideIds.add(g.id);
    return { id: g.id, axis: g.axis as 'x' | 'y', position: g.position };
  });
  return {
    activePageId: value.activePageId,
    pages,
    rulers: value.rulers,
    guidesVisible: value.guidesVisible,
    guides,
  };
}
