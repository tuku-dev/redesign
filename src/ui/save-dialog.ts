/** Filename entry belongs to the app; it never uses window.prompt. */
export function requestDownloadName(current: string): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'save-dialog';
    dialog.setAttribute('aria-labelledby', 'save-dialog-title');
    const form = document.createElement('form');
    form.method = 'dialog';
    const heading = document.createElement('h2');
    heading.id = 'save-dialog-title';
    heading.textContent = 'Download a copy';
    const note = document.createElement('p');
    note.textContent =
      'Save keeps changes in this browser. A downloaded copy does not update automatically.';
    const label = document.createElement('label');
    label.textContent = 'File name';
    const input = document.createElement('input');
    input.name = 'filename';
    input.value = current;
    input.required = true;
    input.setAttribute('aria-label', 'File name');
    const suffix = document.createElement('span');
    suffix.textContent = '.redesign';
    label.append(input, suffix);
    const actions = document.createElement('div');
    actions.className = 'save-dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.onclick = () => dialog.close();
    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = 'Download copy';
    save.className = 'primary';
    actions.append(cancel, save);
    form.append(heading, note, label, actions);
    dialog.append(form);
    document.body.append(dialog);
    let result: string | null = null;
    const previous = document.activeElement as HTMLElement | null;
    form.onsubmit = (e) => {
      e.preventDefault();
      if (!input.value.trim()) {
        input.setCustomValidity('Enter a file name.');
        input.reportValidity();
        return;
      }
      result = input.value.trim();
      dialog.close();
    };
    input.oninput = () => input.setCustomValidity('');
    dialog.addEventListener('keydown', (e) => e.stopPropagation());
    dialog.addEventListener(
      'close',
      () => {
        dialog.remove();
        previous?.focus();
        resolve(result);
      },
      { once: true },
    );
    dialog.showModal();
    input.focus();
    input.select();
  });
}
