import type { DesignDocument, DesignNode } from './types.ts';
import { allNodes } from './workspace.ts';
import { descendants } from './hierarchy.ts';
export class PrototypeSession {
  currentId: string;
  readonly startId: string;
  private history: string[] = [];
  constructor(
    private readonly doc: DesignDocument,
    startId: string,
  ) {
    this.frame(startId);
    this.currentId = startId;
    this.startId = startId;
  }
  frame(id = this.currentId): DesignNode {
    const frame = allNodes(this.doc).find((n) => n.id === id && n.type === 'frame' && !n.parentId);
    if (!frame) throw new Error('Choose a top-level frame as the prototype screen.');
    return frame;
  }
  scene(): DesignDocument {
    const nodes = this.doc.nodes.some((n) => n.id === this.currentId)
      ? this.doc.nodes
      : this.doc.workspace?.pages.find((p) => p.nodes.some((n) => n.id === this.currentId))?.nodes;
    if (!nodes) throw new Error('Prototype screen no longer exists.');
    return { ...this.doc, nodes: descendants({ ...this.doc, nodes }, new Set([this.currentId])) };
  }
  activate(id: string): DesignNode['prototype'] {
    const scene = this.scene();
    let node = scene.nodes.find((n) => n.id === id);
    while (node) {
      if (node.prototype) {
        this.frame(node.prototype.targetId);
        this.history.push(this.currentId);
        this.currentId = node.prototype.targetId;
        return node.prototype;
      }
      node = scene.nodes.find((n) => n.id === node!.parentId);
    }
    return undefined;
  }
  back(): void {
    this.currentId = this.history.pop() ?? this.currentId;
  }
  restart(): void {
    this.history = [];
    this.currentId = this.startId;
  }
  get canGoBack(): boolean {
    return this.history.length > 0;
  }
}
