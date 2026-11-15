import type { Notify } from './notifications.ts';
import { errorMessage } from './elements.ts';
import { bindNumberScrub } from './numeric-scrub.ts';
import type { EditorStore } from '../editor/store.ts';
import { bindColorPreview } from './color-preview.ts';
import { bindPickerOpacity, openColorPicker } from './color-picker.ts';

function normalizedColor(value: string): string | undefined {
  const hex = value.trim();
  if (/^#[\da-f]{6}$/i.test(hex)) return hex.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(hex))
    return `#${hex
      .slice(1)
      .split('')
      .map((digit) => digit + digit)
      .join('')}`.toLowerCase();
  return undefined;
}

function colorField(
  parent: HTMLElement,
  label: string,
  value: string,
  change: (v: string) => void,
  notify: Notify,
  liveColor?: { store: EditorStore; preview: (v: string) => void },
): HTMLInputElement {
  const wrap = document.createElement('div');
  wrap.className = 'feature-field color-field';
  const caption = document.createElement('span');
  caption.textContent = label;
  const controls = document.createElement('div');
  controls.className = 'color-controls';
  const input = document.createElement('input');
  input.type = 'color';
  input.value = value;
  input.setAttribute('aria-label', label);
  const hex = document.createElement('input');
  hex.type = 'text';
  hex.value = value.toUpperCase();
  hex.maxLength = 7;
  hex.spellcheck = false;
  hex.setAttribute('aria-label', `${label} hex value`);
  const apply = (color: string) => {
    input.value = color;
    hex.value = color.toUpperCase();
    if (liveColor) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else run(notify, () => change(color));
  };
  if (liveColor) bindColorPreview(input, liveColor.store, liveColor.preview, notify);
  else input.onchange = () => apply(input.value);
  input.addEventListener('input', () => (hex.value = input.value.toUpperCase()));
  input.onclick = (event) => {
    event.preventDefault();
    openColorPicker(input, apply);
  };
  hex.onchange = () => {
    const color = normalizedColor(hex.value);
    if (!color) {
      hex.value = input.value.toUpperCase();
      return;
    }
    apply(color);
  };
  controls.append(input, hex);
  wrap.append(caption, controls);
  parent.append(wrap);
  return input;
}

export function section(title: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'property-group feature-section';
  const heading = document.createElement('h3');
  heading.textContent = title;
  el.append(heading);
  return el;
}
export function run(notify: Notify, action: () => void): void {
  try {
    action();
  } catch (error) {
    notify(errorMessage(error));
  }
}
export function button(label: string, action: () => void, notify: Notify): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.onclick = () => run(notify, action);
  return b;
}
export function selectField(
  parent: HTMLElement,
  label: string,
  value: string,
  options: readonly (readonly [string, string])[],
  change: (v: string) => void,
  notify: Notify,
): HTMLSelectElement {
  const wrap = document.createElement('label');
  wrap.className = 'feature-field';
  const caption = document.createElement('span');
  caption.textContent = label;
  const select = document.createElement('select');
  select.setAttribute('aria-label', label);
  for (const [id, text] of options) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = text;
    select.append(o);
  }
  select.value = value;
  select.onchange = () => run(notify, () => change(select.value));
  wrap.append(caption, select);
  parent.append(wrap);
  return select;
}
export function inputField(
  parent: HTMLElement,
  label: string,
  value: string | number,
  type: 'number' | 'text' | 'color',
  change: (v: string) => void,
  notify: Notify,
  liveColor?: { store: EditorStore; preview: (v: string) => void },
): HTMLInputElement {
  if (type === 'color') return colorField(parent, label, String(value), change, notify, liveColor);
  const wrap = document.createElement('label');
  wrap.className = 'feature-field';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  input.value = String(value);
  input.setAttribute('aria-label', label);
  if (type === 'number') {
    input.step = 'any';
    bindNumberScrub(caption, input);
  }
  input.onchange = () => run(notify, () => change(input.value));
  wrap.append(caption, input);
  parent.append(wrap);
  return input;
}

/** Bind the swatch's paint alpha to the shared custom picker's opacity controls. */
export function bindColorOpacity(
  color: HTMLInputElement,
  label: string,
  value: number,
  change: (value: string) => void,
  notify: Notify,
): { value: string } {
  color.setAttribute('aria-description', `${label} is available in the color picker.`);
  return bindPickerOpacity(color, value, (value) => run(notify, () => change(value)));
}
export function checkbox(
  parent: HTMLElement,
  label: string,
  value: boolean,
  change: (v: boolean) => void,
  notify: Notify,
): void {
  const wrap = document.createElement('label');
  wrap.className = 'feature-check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = value;
  input.onchange = () => run(notify, () => change(input.checked));
  wrap.append(input, document.createTextNode(label));
  parent.append(wrap);
}
