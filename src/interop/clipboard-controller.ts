import { bounds } from '../model/geometry.ts';
import { descendants, detachedCopy, selectionRoots } from '../model/hierarchy.ts';
import type { DesignNode, Point } from '../model/types.ts';
import type { EditorStore } from '../editor/store.ts';
import type { GestureController } from '../editor/gestures.ts';
import type { EditingCommands } from '../commands/editing.ts';
import { cloneNodes } from '../commands/transforms.ts';
import { editableTarget } from '../ui/elements.ts';
import type { Notify } from '../ui/notifications.ts';
import { encodeClipboard, decodeClipboard } from './clipboard-codec.ts';
export class ClipboardController {
  nodes: DesignNode[] = [];
  pasteInPlace = false;
  private pasteCount = 0;
  constructor(
    private readonly store: EditorStore,
    private readonly notify: Notify,
  ) {}
  copy(): void {
    if (!this.store.selected.size) return;
    this.nodes = detachedCopy(descendants(this.store.doc, this.store.selected));
    this.pasteCount = 0;
    this.store.refresh();
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard
        .writeText(encodeClipboard(this.nodes))
        .then(() => this.notify('Layers copied to clipboard.'))
        .catch(() => this.notify('Copied in this tab. Use Paste in the properties panel.'));
    } else this.notify('Copied in this tab. Use Paste in the properties panel.');
  }
  paste(inPlace = false, at?: Point): void {
    if (!this.nodes.length) return this.notify('Copy layers in this tab first.');
    const offset = inPlace ? 0 : ++this.pasteCount * 20,
      s = this.store;
    const box = bounds(this.nodes);
    s.change(() => {
      const copies = cloneNodes(
        this.nodes,
        at && box ? at.x - box.x : offset,
        at && box ? at.y - box.y : offset,
      );
      s.doc.nodes.push(...copies);
      s.selected = new Set(
        selectionRoots({ ...s.doc, nodes: copies }, new Set(copies.map((n) => n.id))).map(
          (n) => n.id,
        ),
      );
    });
  }
  async readAndPaste(inPlace = false, at?: Point): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        const nodes = decodeClipboard(await navigator.clipboard.readText());
        if (encodeClipboard(nodes) !== encodeClipboard(this.nodes)) this.pasteCount = 0;
        this.nodes = nodes;
      } catch {
        if (!this.nodes.length) {
          this.notify('Copy reDesign layers first, or use Ctrl+V to paste.');
          return;
        }
      }
    }
    this.paste(inPlace, at);
  }
  bind(target: Document, gestures: GestureController, commands: EditingCommands): void {
    for (const action of ['copy', 'cut'] as const)
      target.addEventListener(action, (e) => {
        if (
          editableTarget(e.target) ||
          gestures.active ||
          !this.store.selected.size ||
          !e.clipboardData
        )
          return;
        const nodes = detachedCopy(descendants(this.store.doc, this.store.selected));
        try {
          e.clipboardData.setData('text/plain', encodeClipboard(nodes));
          e.preventDefault();
          this.nodes = nodes;
          this.pasteCount = 0;
          if (action === 'cut') commands.remove();
        } catch {
          this.notify('Clipboard write failed. Your layers were not cut.');
        }
      });
    target.addEventListener('paste', (e) => {
      if (editableTarget(e.target) || gestures.active || !e.clipboardData) return;
      const text = e.clipboardData.getData('text/plain');
      if (!text) return;
      try {
        const nodes = decodeClipboard(text);
        e.preventDefault();
        if (encodeClipboard(nodes) !== encodeClipboard(this.nodes)) this.pasteCount = 0;
        this.nodes = nodes;
        this.paste(this.pasteInPlace);
      } catch {
        if (text.includes('redesign-clipboard')) {
          e.preventDefault();
          this.notify('Invalid or unsupported reDesign clipboard data.');
        }
      } finally {
        this.pasteInPlace = false;
      }
    });
  }
}
