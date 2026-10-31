import type { Notify } from './notifications.ts';
import { errorMessage } from './elements.ts';
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
): HTMLInputElement {
  const wrap = document.createElement('label');
  wrap.className = 'feature-field';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  input.value = String(value);
  input.setAttribute('aria-label', label);
  if (type === 'number') input.step = 'any';
  input.onchange = () => run(notify, () => change(input.value));
  wrap.append(caption, input);
  parent.append(wrap);
  return input;
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
