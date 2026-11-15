import { showDraggableModal } from './modal.ts';
import { createIcon } from './icons.ts';

interface AlphaBinding {
  value: string;
  change: (value: string) => void;
}
const alphaBindings = new WeakMap<HTMLInputElement, AlphaBinding>();

export function bindPickerOpacity(
  input: HTMLInputElement,
  value: number,
  change: (value: string) => void,
): AlphaBinding {
  const binding = { value: String(value), change };
  alphaBindings.set(input, binding);
  return binding;
}

function hsv(hex: string): [number, number, number] {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels as [number, number, number];
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  return [(h * 60 + 360) % 360, max ? delta / max : 0, max];
}

function hexColor(h: number, s: number, v: number): string {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}

/** Custom picker shared by fill, border, shadow, and gradient-stop swatches. */
export function openColorPicker(source: HTMLInputElement, apply: (color: string) => void): void {
  const alpha = alphaBindings.get(source);
  let [h, s, v] = hsv(source.value);
  let color = source.value;
  let opacity = Number(alpha?.value ?? 1);
  const dialog = document.createElement('dialog');
  dialog.className = 'gradient-editor color-picker-dialog';
  dialog.setAttribute('aria-label', 'Color picker');
  const header = document.createElement('div');
  header.className = 'modal-header';
  const title = document.createElement('h2');
  title.textContent = 'Custom color';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'gradient-editor-close';
  close.setAttribute('aria-label', 'Close color picker');
  close.append(createIcon('close'));
  close.onclick = () => dialog.close();
  header.append(title, close);

  const palette = document.createElement('div');
  palette.className = 'color-palette';
  palette.setAttribute('role', 'group');
  palette.setAttribute('aria-label', 'Saturation and brightness');
  const marker = document.createElement('span');
  marker.className = 'color-palette-marker';
  marker.setAttribute('aria-hidden', 'true');
  palette.append(marker);
  const range = (label: string, max: number, className: string) => {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = String(max);
    input.step = '1';
    input.className = className;
    input.setAttribute('aria-label', label);
    return input;
  };
  const hue = range('Hue', 360, 'picker-hue');
  const saturation = range('Saturation', 100, 'picker-accessible-range');
  const brightness = range('Brightness', 100, 'picker-accessible-range');
  const alphaSlider = range('Color opacity slider', 100, 'picker-alpha');
  const values = document.createElement('div');
  values.className = 'picker-values';
  const format = document.createElement('select');
  format.setAttribute('aria-label', 'Color format');
  for (const name of ['Hex', 'RGB', 'HSL', 'HSB']) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    format.append(option);
  }
  const code = document.createElement('input');
  code.type = 'text';
  code.spellcheck = false;
  code.setAttribute('aria-label', 'Color value');
  const percentLabel = document.createElement('label');
  percentLabel.className = 'picker-percent';
  const percent = document.createElement('input');
  percent.type = 'number';
  percent.min = '0';
  percent.max = '100';
  percent.step = '1';
  percent.setAttribute('aria-label', 'Color opacity percent');
  percentLabel.append(percent, document.createTextNode('%'));
  values.append(format, code, percentLabel);
  const formatted = () => {
    if (format.value === 'RGB')
      return [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16)).join(', ');
    if (format.value === 'HSB')
      return `${Math.round(h)}, ${Math.round(s * 100)}, ${Math.round(v * 100)}`;
    if (format.value === 'HSL') {
      const l = v * (1 - s / 2);
      const saturation = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
      return `${Math.round(h)}, ${Math.round(saturation * 100)}, ${Math.round(l * 100)}`;
    }
    return color.slice(1).toUpperCase();
  };
  const refresh = () => {
    palette.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${h} 100% 50%)`;
    marker.style.left = `${s * 100}%`;
    marker.style.top = `${(1 - v) * 100}%`;
    marker.style.background = color;
    hue.value = String(h);
    saturation.value = String(s * 100);
    brightness.value = String(v * 100);
    alphaSlider.value = String(opacity * 100);
    alphaSlider.style.setProperty('--alpha-color', color);
    percent.value = String(Math.round(opacity * 100));
    code.value = formatted();
  };
  const commitColor = () => {
    color = hexColor(h, s, v);
    apply(color);
    refresh();
  };
  const setAlpha = (value: number, commit: boolean) => {
    if (!Number.isFinite(value)) return refresh();
    opacity = Math.max(0, Math.min(100, value)) / 100;
    refresh();
    if (commit && alpha) {
      alpha.value = String(opacity);
      alpha.change(alpha.value);
    }
  };
  palette.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const before = { s, v };
    palette.setPointerCapture(event.pointerId);
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== event.pointerId) return;
      const box = palette.getBoundingClientRect();
      s = Math.max(0, Math.min(1, (pointer.clientX - box.left) / box.width));
      v = 1 - Math.max(0, Math.min(1, (pointer.clientY - box.top) / box.height));
      color = hexColor(h, s, v);
      refresh();
    };
    const finish = (pointer: PointerEvent) => {
      if (pointer.pointerId !== event.pointerId) return;
      palette.removeEventListener('pointermove', move);
      palette.removeEventListener('pointerup', finish);
      palette.removeEventListener('pointercancel', finish);
      if (palette.hasPointerCapture(event.pointerId))
        palette.releasePointerCapture(event.pointerId);
      if (pointer.type === 'pointercancel') {
        s = before.s;
        v = before.v;
        color = hexColor(h, s, v);
        refresh();
        return;
      }
      commitColor();
    };
    move(event);
    palette.addEventListener('pointermove', move);
    palette.addEventListener('pointerup', finish);
    palette.addEventListener('pointercancel', finish);
  });
  hue.oninput = () => {
    h = Number(hue.value);
    color = hexColor(h, s, v);
    refresh();
  };
  hue.onchange = commitColor;
  saturation.oninput = () => {
    s = Number(saturation.value) / 100;
    color = hexColor(h, s, v);
    refresh();
  };
  saturation.onchange = commitColor;
  brightness.oninput = () => {
    v = Number(brightness.value) / 100;
    color = hexColor(h, s, v);
    refresh();
  };
  brightness.onchange = commitColor;
  alphaSlider.oninput = () => setAlpha(Number(alphaSlider.value), false);
  alphaSlider.onchange = () => setAlpha(Number(alphaSlider.value), true);
  percent.onchange = () => setAlpha(percent.value === '' ? NaN : Number(percent.value), true);
  format.onchange = refresh;
  code.onchange = () => {
    if (format.value === 'Hex') {
      let hex = code.value.trim().replace(/^#/, '');
      if (/^[\da-f]{3}$/i.test(hex)) hex = [...hex].map((c) => c + c).join('');
      if (!/^[\da-f]{6}$/i.test(hex)) return refresh();
      color = `#${hex.toLowerCase()}`;
      [h, s, v] = hsv(color);
    } else {
      const parts = code.value
        .trim()
        .split(/[,\s]+/)
        .map(Number);
      if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return refresh();
      const [a, b, c] = parts as [number, number, number];
      if (format.value === 'RGB') {
        if (parts.some((n) => n < 0 || n > 255)) return refresh();
        color = `#${parts.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
        [h, s, v] = hsv(color);
      } else {
        if (a < 0 || a > 360 || b < 0 || b > 100 || c < 0 || c > 100) return refresh();
        h = a;
        if (format.value === 'HSL') {
          const l = c / 100;
          v = l + (b / 100) * Math.min(l, 1 - l);
          s = v ? 2 * (1 - l / v) : 0;
        } else {
          s = b / 100;
          v = c / 100;
        }
        color = hexColor(h, s, v);
      }
    }
    apply(color);
    refresh();
  };
  dialog.append(header, palette, saturation, brightness, hue);
  if (alpha) dialog.append(alphaSlider);
  else percentLabel.hidden = true;
  dialog.append(values);
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  dialog.addEventListener(
    'close',
    () => {
      dialog.remove();
      if (source.isConnected) source.focus();
      else
        document
          .querySelector<HTMLInputElement>(
            'input[type="color"][aria-label="' +
              CSS.escape(source.getAttribute('aria-label') ?? '') +
              '"]',
          )
          ?.focus();
    },
    { once: true },
  );
  document.body.append(dialog);
  refresh();
  showDraggableModal(dialog);
}
