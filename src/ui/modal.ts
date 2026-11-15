const modalStack: HTMLDialogElement[] = [];

/** Show an app modal with dragging and backdrop dismissal through its normal cancel path. */
export function showDraggableModal(dialog: HTMLDialogElement): void {
  let startedOutside = false;
  const outside = (event: MouseEvent) => {
    const bounds = dialog.getBoundingClientRect();
    return (
      event.target === dialog &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom)
    );
  };
  dialog.addEventListener('pointerdown', (event) => {
    startedOutside = event.button === 0 && outside(event);
  });
  dialog.addEventListener('pointercancel', () => {
    startedOutside = false;
  });
  dialog.addEventListener('click', (event) => {
    const dismiss = startedOutside && outside(event);
    startedOutside = false;
    if (!dismiss || modalStack.findLast((modal) => modal.open && modal.isConnected) !== dialog)
      return;
    event.preventDefault();
    event.stopPropagation();
    if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
  });
  dialog.addEventListener(
    'close',
    () => {
      const index = modalStack.indexOf(dialog);
      if (index !== -1) modalStack.splice(index, 1);
    },
    { once: true },
  );
  const headerSelector = '.modal-header';
  dialog.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    const header = event.target.closest(headerSelector);
    if (!header || !dialog.contains(header)) return;
    if (event.target.closest('button, input, select, textarea, a, [contenteditable]')) return;
    event.preventDefault();
    const bounds = dialog.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    dialog.style.position = 'fixed';
    dialog.style.margin = '0';
    dialog.style.inset = 'auto';
    dialog.style.boxSizing = 'border-box';
    dialog.style.width = `${bounds.width}px`;
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== event.pointerId) return;
      const width = dialog.getBoundingClientRect().width;
      const height = dialog.getBoundingClientRect().height;
      dialog.style.left = `${Math.max(0, Math.min(window.innerWidth - width, bounds.left + pointer.clientX - startX))}px`;
      dialog.style.top = `${Math.max(0, Math.min(window.innerHeight - height, bounds.top + pointer.clientY - startY))}px`;
    };
    move(event);
    dialog.setPointerCapture(event.pointerId);
    const finish = (pointer: PointerEvent) => {
      if (pointer.pointerId !== event.pointerId) return;
      dialog.removeEventListener('pointermove', move);
      dialog.removeEventListener('pointerup', finish);
      dialog.removeEventListener('pointercancel', finish);
      dialog.removeEventListener('lostpointercapture', finish);
      if (dialog.hasPointerCapture(event.pointerId)) dialog.releasePointerCapture(event.pointerId);
    };
    dialog.addEventListener('pointermove', move);
    dialog.addEventListener('pointerup', finish);
    dialog.addEventListener('pointercancel', finish);
    dialog.addEventListener('lostpointercapture', finish);
  });
  dialog.showModal();
  modalStack.push(dialog);
}
