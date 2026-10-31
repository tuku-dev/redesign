function required<T extends Element>(id: string, type: new (...args: never[]) => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`Missing or invalid editor element: ${id}`);
  return el;
}
export function getElements() {
  return {
    canvas: required('canvas', SVGSVGElement),
    workspace: required('workspace', HTMLElement),
    snapGridEnabled: required('snap-grid-enabled', HTMLButtonElement),
    pickColor: required('pick-color', HTMLButtonElement),
    viewport: required('viewport', SVGGElement),
    scene: required('scene', SVGGElement),
    selection: required('selection', SVGGElement),
    documentName: required('document-name', HTMLInputElement),
    saveStatus: required('save-status', HTMLElement),
    toast: required('toast', HTMLElement),
    layers: required('layers', HTMLElement),
    properties: required('properties', HTMLElement),
    undo: required('undo', HTMLButtonElement),
    redo: required('redo', HTMLButtonElement),
    add: required('add', HTMLButtonElement),
    zoomIn: required('zoom-in', HTMLButtonElement),
    zoomOut: required('zoom-out', HTMLButtonElement),
    zoomReset: required('zoom-reset', HTMLButtonElement),
    fitAll: required('fit-all', HTMLButtonElement),
    fitSelection: required('fit-selection', HTMLButtonElement),
    newDocument: required('new-document', HTMLButtonElement),
    save: required('save', HTMLButtonElement),
    saveAs: required('save-as', HTMLButtonElement),
    open: required('open', HTMLButtonElement),
    exportSvg: required('export', HTMLButtonElement),
    file: required('file', HTMLInputElement),
    toolButtons: [...document.querySelectorAll<HTMLButtonElement>('[data-tool]')],
  };
}
export type EditorElements = ReturnType<typeof getElements>;
export function editableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element && !!target.closest('input,textarea,select,dialog,[contenteditable]')
  );
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}
