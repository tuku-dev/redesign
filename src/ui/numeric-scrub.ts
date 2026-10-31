export function bindNumberScrub(caption: HTMLElement, input: HTMLInputElement): void {
  caption.classList.add('scrubbable');
  caption.title = 'Drag horizontally to adjust';
  let drag:
    | {
        pointerId: number;
        startX: number;
        startValue: number;
        changed: boolean;
      }
    | undefined;

  caption.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || input.disabled || input.value === '') return;
    const startValue = Number(input.value);
    if (!Number.isFinite(startValue)) return;
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startValue,
      changed: false,
    };
    caption.setPointerCapture(event.pointerId);
  });
  caption.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) < 2) return;
    event.preventDefault();
    const step = input.step === 'any' ? 1 : Number(input.step) || 1,
      multiplier = event.altKey ? 0.1 : event.shiftKey ? 10 : 1,
      precision = Math.min(
        8,
        Math.max(
          input.step === 'any' ? 2 : 0,
          (String(step).split('.')[1] ?? '').length,
          event.altKey ? 2 : 0,
        ),
      ),
      min = input.min === '' ? -Infinity : Number(input.min),
      max = input.max === '' ? Infinity : Number(input.max),
      value = Math.min(max, Math.max(min, drag.startValue + (delta / 4) * step * multiplier));
    input.value = String(Number(value.toFixed(precision)));
    drag.changed = true;
  });
  const finish = (event: PointerEvent, cancel: boolean) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const changed = drag.changed;
    if (cancel) input.value = String(drag.startValue);
    drag = undefined;
    if (caption.hasPointerCapture(event.pointerId)) caption.releasePointerCapture(event.pointerId);
    if (!cancel && changed) input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  caption.addEventListener('pointerup', (event) => finish(event, false));
  caption.addEventListener('pointercancel', (event) => finish(event, true));
  caption.addEventListener('lostpointercapture', (event) => finish(event, true));
}
