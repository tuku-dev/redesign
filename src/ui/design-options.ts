import type { EditorStore } from '../editor/store.ts';
import { NodeOptionCommands } from '../commands/node-options.ts';
import type { NodeOptions, ConstraintMode } from '../model/types.ts';
import { isLocked } from '../model/layer-state.ts';
import type { Notify } from './notifications.ts';
import { errorMessage } from './elements.ts';
export function renderDesignOptions(area: HTMLElement, store: EditorStore, notify: Notify): void {
  const nodes = store.chosen(),
    first = nodes[0];
  if (!first) return;
  const commands = new NodeOptionCommands(store),
    disabled = nodes.some((n) => isLocked(store.doc, n));
  const section = (title: string) => {
    const block = document.createElement('div');
    block.className = 'design-options';
    const heading = document.createElement('h3');
    heading.textContent = title;
    block.append(heading);
    area.append(block);
    return block;
  };
  function numberField<K extends 'rotation' | 'fontWeight' | 'lineHeight' | 'letterSpacing'>(
    block: HTMLElement,
    key: K,
    label: string,
    min: number,
    max: number,
    step: string,
  ): void {
    const wrap = document.createElement('label');
    wrap.className = 'field';
    const text = document.createElement('span');
    text.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.step = step;
    input.disabled = disabled;
    input.setAttribute('aria-label', label);
    if (nodes.some((n) => n[key] !== first[key])) input.placeholder = 'Mixed';
    else input.value = String(first[key]);
    input.onchange = () => {
      if (!input.value) return;
      try {
        commands.set(key, Number(input.value));
      } catch (error) {
        notify(errorMessage(error));
        store.refresh();
      }
    };
    wrap.append(text, input);
    block.append(wrap);
  }
  function selectField<
    K extends 'constraintX' | 'constraintY' | 'fontStyle' | 'textAlign' | 'textWrap',
  >(
    block: HTMLElement,
    key: K,
    label: string,
    values: readonly (readonly [NodeOptions[K], string])[],
  ): void {
    const wrap = document.createElement('label');
    wrap.className = 'option-field';
    const text = document.createElement('span');
    text.textContent = label;
    const input = document.createElement('select');
    input.disabled = disabled;
    input.setAttribute('aria-label', label);
    const mixed = nodes.some((n) => n[key] !== first[key]);
    if (mixed) {
      const option = new Option('Mixed', 'mixed');
      option.disabled = true;
      input.append(option);
    }
    for (const [value, title] of values) input.append(new Option(title, value));
    input.value = mixed ? 'mixed' : first[key];
    input.onchange = () => {
      const match = values.find(([value]) => value === input.value);
      if (match) commands.set(key, match[0]);
    };
    wrap.append(text, input);
    block.append(wrap);
  }
  numberField(section('Rotation'), 'rotation', 'Angle (°)', -1000000, 1000000, '1');
  if (nodes.every((n) => n.type === 'frame')) {
    const block = section('Frame'),
      wrap = document.createElement('label');
    wrap.className = 'option-checkbox';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.disabled = disabled;
    input.checked = nodes.every((n) => n.clipContent);
    input.indeterminate = nodes.some((n) => n.clipContent) && !input.checked;
    input.onchange = () => commands.set('clipContent', input.checked);
    wrap.append(input, document.createTextNode('Clip content'));
    block.append(wrap);
  }
  const byId = new Map(store.doc.nodes.map((n) => [n.id, n]));
  if (nodes.every((n) => n.parentId && byId.get(n.parentId)?.type === 'frame')) {
    const block = section('Constraints');
    const horizontal: readonly (readonly [ConstraintMode, string])[] = [
      ['start', 'Left'],
      ['end', 'Right'],
      ['center', 'Center'],
      ['stretch', 'Left and right'],
      ['scale', 'Scale'],
    ];
    const vertical: readonly (readonly [ConstraintMode, string])[] = [
      ['start', 'Top'],
      ['end', 'Bottom'],
      ['center', 'Center'],
      ['stretch', 'Top and bottom'],
      ['scale', 'Scale'],
    ];
    selectField(block, 'constraintX', 'Horizontal', horizontal);
    selectField(block, 'constraintY', 'Vertical', vertical);
  }
  if (nodes.every((n) => n.type === 'text')) {
    const block = section('Typography'),
      label = document.createElement('label');
    label.className = 'option-field';
    const caption = document.createElement('span');
    caption.textContent = 'Font family';
    const family = document.createElement('input');
    family.type = 'text';
    family.disabled = disabled;
    family.setAttribute('aria-label', 'Font family');
    family.value = nodes.every((n) => n.fontFamily === first.fontFamily) ? first.fontFamily : '';
    family.placeholder = 'Mixed';
    family.onchange = () => {
      try {
        commands.set('fontFamily', family.value.trim());
      } catch (error) {
        notify(errorMessage(error));
        store.refresh();
      }
    };
    label.append(caption, family);
    block.append(label);
    numberField(block, 'fontWeight', 'Weight', 100, 900, '100');
    selectField(block, 'fontStyle', 'Style', [
      ['normal', 'Normal'],
      ['italic', 'Italic'],
    ]);
    numberField(block, 'lineHeight', 'Line height ×', 0.5, 10, '.1');
    numberField(block, 'letterSpacing', 'Letter spacing', -10000, 10000, '.1');
    selectField(block, 'textAlign', 'Alignment', [
      ['left', 'Left'],
      ['center', 'Center'],
      ['right', 'Right'],
    ]);
    selectField(block, 'textWrap', 'Wrapping', [
      ['none', 'No wrap'],
      ['word', 'Word wrap'],
    ]);
  }
}
