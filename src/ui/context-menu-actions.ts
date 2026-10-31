import type { EditingCommands } from '../commands/editing.ts';
import type { StructureCommands } from '../commands/structure.ts';
import type { LayerStateCommands } from '../commands/layer-state.ts';
import type { LayerOrderCommands } from '../commands/layer-order.ts';
import type { SelectionCommands } from '../commands/selection.ts';
import type { EditorStore } from '../editor/store.ts';
import type { ClipboardController } from '../interop/clipboard-controller.ts';
import type { Point, Alignment } from '../model/types.ts';
import { isLocked } from '../model/layer-state.ts';
import { selectionRoots } from '../model/hierarchy.ts';
export interface MenuEntry {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  run?: () => void | Promise<void>;
  children?: MenuSection[];
}
export type MenuSection = MenuEntry[];
export interface MenuServices {
  store: EditorStore;
  commands: EditingCommands;
  structure: StructureCommands;
  states: LayerStateCommands;
  order: LayerOrderCommands;
  selection: SelectionCommands;
  clipboard: ClipboardController;
  fit: (selectionOnly: boolean) => void;
  rename: () => void;
  exportSelection: () => void;
}
export function buildContextMenu(s: MenuServices, point: Point): MenuSection[] {
  const nodes = s.store.chosen(),
    roots = selectionRoots(s.store.doc, s.store.selected),
    has = nodes.length > 0,
    locked = nodes.some((n) => isLocked(s.store.doc, n)),
    editable = has && !locked;
  const hits = s.selection.at(point),
    byId = new Map(s.store.doc.nodes.map((n) => [n.id, n]));
  const paste = (inPlace = false, at?: Point) => s.clipboard.readAndPaste(inPlace, at);
  const sections: MenuSection[] = [
    [
      {
        id: 'undo',
        label: 'Undo',
        shortcut: 'Ctrl+Z',
        disabled: !s.store.history.past.length,
        run: () => s.store.undo(),
      },
      {
        id: 'redo',
        label: 'Redo',
        shortcut: 'Ctrl+Shift+Z',
        disabled: !s.store.history.future.length,
        run: () => s.store.redo(),
      },
    ],
  ];
  if (has)
    sections.push([
      {
        id: 'cut',
        label: 'Cut',
        shortcut: 'Ctrl+X',
        disabled: !editable,
        run: () => {
          s.clipboard.copy();
          s.commands.remove();
        },
      },
      { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', run: () => s.clipboard.copy() },
      { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V', run: () => paste() },
      { id: 'paste-here', label: 'Paste here', run: () => paste(false, point) },
      {
        id: 'paste-in-place',
        label: 'Paste in place',
        shortcut: 'Ctrl+Shift+V',
        run: () => paste(true),
      },
      {
        id: 'duplicate',
        label: 'Duplicate',
        shortcut: 'Ctrl+D',
        disabled: !editable,
        run: () => s.commands.duplicate(),
      },
      {
        id: 'rename',
        label: 'Rename',
        shortcut: 'F2',
        disabled: !editable || nodes.length !== 1,
        run: s.rename,
      },
    ]);
  else
    sections.push([
      { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V', run: () => paste() },
      { id: 'paste-here', label: 'Paste here', run: () => paste(false, point) },
    ]);
  const select: MenuSection = [
    { id: 'select-all', label: 'Select all', shortcut: 'Ctrl+A', run: () => s.selection.all() },
  ];
  if (has)
    select.push(
      { id: 'select-none', label: 'Deselect all', shortcut: 'Esc', run: () => s.selection.none() },
      {
        id: 'select-parent',
        label: 'Select parent',
        shortcut: 'Shift+Enter',
        disabled: !nodes.some((n) => n.parentId),
        run: () => s.selection.parent(),
      },
      {
        id: 'select-children',
        label: 'Select children',
        shortcut: 'Enter',
        disabled: !s.store.doc.nodes.some((n) => n.parentId && s.store.selected.has(n.parentId)),
        run: () => s.selection.children(),
      },
    );
  if (hits.length)
    select.push({
      id: 'select-layer',
      label: 'Select layer',
      children: [
        hits.map((id) => ({
          id: `select-${id}`,
          label: byId.get(id)!.name + (isLocked(s.store.doc, byId.get(id)!) ? ' (locked)' : ''),
          run: () => s.selection.select(id),
        })),
      ],
    });
  sections.push(select);
  if (has) {
    sections.push([
      {
        id: 'front',
        label: 'Bring to front',
        shortcut: 'Ctrl+Shift+]',
        disabled: !editable,
        run: () => s.order.order('front'),
      },
      {
        id: 'forward',
        label: 'Bring forward',
        shortcut: 'Ctrl+]',
        disabled: !editable,
        run: () => s.order.order('forward'),
      },
      {
        id: 'backward',
        label: 'Send backward',
        shortcut: 'Ctrl+[',
        disabled: !editable,
        run: () => s.order.order('backward'),
      },
      {
        id: 'back',
        label: 'Send to back',
        shortcut: 'Ctrl+Shift+[',
        disabled: !editable,
        run: () => s.order.order('back'),
      },
    ]);
    sections.push([
      {
        id: 'group',
        label: 'Group selection',
        shortcut: 'Ctrl+G',
        disabled: !editable,
        run: () => s.structure.wrap('group'),
      },
      {
        id: 'frame',
        label: 'Frame selection',
        shortcut: 'Ctrl+Alt+G',
        disabled: !editable,
        run: () => s.structure.wrap('frame'),
      },
      {
        id: 'ungroup',
        label: 'Ungroup / remove container',
        shortcut: 'Ctrl+Shift+G',
        disabled: !editable || !roots.some((n) => n.type === 'group' || n.type === 'frame'),
        run: () => s.structure.unwrap(),
      },
    ]);
    sections.push([
      {
        id: 'rotate-flip',
        label: 'Rotate / flip',
        disabled: !editable,
        children: [
          [
            {
              id: 'rotate-90-cw',
              label: 'Rotate 90° clockwise',
              run: () => s.commands.rotate(90),
            },
            { id: 'rotate-180', label: 'Rotate 180°', run: () => s.commands.rotate(180) },
            {
              id: 'rotate-90-ccw',
              label: 'Rotate 90° counterclockwise',
              run: () => s.commands.rotate(-90),
            },
          ],
          [
            {
              id: 'flip-horizontal',
              label: 'Flip horizontal',
              run: () => s.commands.flip('horizontal'),
            },
            {
              id: 'flip-vertical',
              label: 'Flip vertical',
              run: () => s.commands.flip('vertical'),
            },
          ],
        ],
      },
    ]);
    const alignments: readonly (readonly [Alignment, string])[] = [
      ['left', 'Align left'],
      ['center', 'Align horizontal centers'],
      ['right', 'Align right'],
      ['top', 'Align top'],
      ['middle', 'Align vertical centers'],
      ['bottom', 'Align bottom'],
    ];
    sections.push([
      {
        id: 'align',
        label: 'Align / distribute',
        disabled: !editable || roots.length < 2,
        children: [
          alignments.map(([mode, label]) => ({
            id: `align-${mode}`,
            label,
            run: () => s.commands.align(mode),
          })),
          [
            {
              id: 'distribute-x',
              label: 'Distribute horizontally',
              disabled: roots.length < 3,
              run: () => s.commands.distribute('x'),
            },
            {
              id: 'distribute-y',
              label: 'Distribute vertically',
              disabled: roots.length < 3,
              run: () => s.commands.distribute('y'),
            },
          ],
        ],
      },
    ]);
    sections.push([
      {
        id: 'lock',
        label: nodes.every((n) => n.locked) ? 'Unlock selection' : 'Lock selection',
        shortcut: 'Ctrl+Shift+L',
        run: () => s.states.toggle('locked'),
      },
      {
        id: 'hide',
        label: nodes.every((n) => n.hidden) ? 'Show selection' : 'Hide selection',
        shortcut: 'Ctrl+Shift+H',
        run: () => s.states.toggle('hidden'),
      },
    ]);
  }
  sections.push([
    {
      id: 'unlock-all',
      label: 'Unlock all layers',
      disabled: !s.store.doc.nodes.some((n) => n.locked),
      run: () => s.states.unlockAll(),
    },
    {
      id: 'show-all',
      label: 'Show all layers',
      disabled: !s.store.doc.nodes.some((n) => n.hidden),
      run: () => s.states.revealAll(),
    },
  ]);
  sections.push([
    { id: 'fit-all', label: 'Zoom to fit', shortcut: 'Shift+1', run: () => s.fit(false) },
    ...(has
      ? [
          {
            id: 'fit-selection',
            label: 'Zoom to selection',
            shortcut: 'Shift+2',
            run: () => s.fit(true),
          },
          { id: 'export-selection', label: 'Export selection as SVG', run: s.exportSelection },
        ]
      : []),
  ]);
  if (has)
    sections.push([
      {
        id: 'delete',
        label: 'Delete',
        shortcut: 'Delete',
        danger: true,
        disabled: !editable,
        run: () => s.commands.remove(),
      },
    ]);
  return sections;
}
