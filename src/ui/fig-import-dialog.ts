import type { FigImportReport } from '../interop/fig/import.ts';

/** Every native import gets a review step before opening its lossy editable subset. */
export function confirmFigImport(report: FigImportReport): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'save-dialog fig-import-dialog';
    dialog.setAttribute('aria-label', 'Review experimental Figma import');
    const title = document.createElement('h2');
    title.textContent = 'Experimental Figma import';
    const summary = document.createElement('p');
    summary.textContent = `${report.pages} page(s), ${report.imported} editable layer(s), ${report.skipped} skipped layer(s). Writer version ${report.version}.`;
    const note = document.createElement('p');
    note.textContent =
      'This imports a limited subset. Figma export and editable round trips are not available. Keep your original .fig file.';
    const list = document.createElement('ul');
    const warnings = [...report.warnings];
    if (report.skipped)
      warnings.unshift('Skipped layers/subtrees: ' + report.skippedTypes.join(', ') + '.');
    warnings.push(
      'Components, instances, vectors, images, constraints, shared styles, variables, prototypes and unsupported document settings are not preserved.',
    );
    for (const message of warnings) {
      const item = document.createElement('li');
      item.textContent = message;
      list.append(item);
    }
    const actions = document.createElement('div');
    actions.className = 'save-dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'primary';
    accept.textContent = 'Import supported layers';
    const previous = document.activeElement as HTMLElement | null;
    dialog.addEventListener('keydown', (event) => event.stopPropagation());
    const finish = (ok: boolean) => {
      dialog.close();
      dialog.remove();
      previous?.focus();
      resolve(ok);
    };
    cancel.onclick = () => finish(false);
    accept.onclick = () => finish(true);
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(false);
    });
    actions.append(cancel, accept);
    dialog.append(title, summary, note, list, actions);
    document.body.append(dialog);
    dialog.showModal();
    cancel.focus();
  });
}
