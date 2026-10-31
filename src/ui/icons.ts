// Original outline icons on a shared 24px grid. Color follows the control state.
const paths = {
  pen: 'M3 21 6 10 14 4 20 10 14 18 3 21Z M3 21l7.5-7.5 M14 4l2-2 6 6-2 2 M13.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0',
  path: 'M4 20 7 7 20 4 17 17 Z M7 7 17 17 M4 20 11 13',
  group: 'M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6z',
  lock: 'M7 10V7a5 5 0 0110 0v3M5 10h14v11H5zM12 14v3',
  unlock: 'M7 10V7a5 5 0 019-3M5 10h14v11H5zM12 14v3',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM15 12a3 3 0 11-6 0 3 3 0 016 0',
  eyeOff:
    'M3 3l18 18M9 5a12 12 0 013 0c6 0 10 7 10 7a17 17 0 01-4 4M6 6a18 18 0 00-4 6s4 7 10 7a12 12 0 005-1',
  select: 'M5 3l14 10-7 1-3 7z',
  hand: 'M8 12V5a2 2 0 014 0v7-7a2 2 0 014 0v8-5a2 2 0 014 0v8c0 4-3 7-7 7h-1c-2 0-4-1-5-3l-4-6a2 2 0 013-2l2 2',
  frame: 'M8 3v18M16 3v18M3 8h18M3 16h18',
  rectangle: 'M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z',
  ellipse: 'M20 12a8 8 0 11-16 0 8 8 0 0116 0',
  text: 'M5 7V4h14v3M12 4v16M8 20h8',
  undo: 'M8 5L3 10l5 5M3 10h11a6 6 0 010 12',
  redo: 'M16 5l5 5-5 5M21 10H10a6 6 0 000 12',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  page: 'M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6',
  open: 'M3 19V6h7l2 3h9M3 19l3-8h16l-3 8z',
  save: 'M5 3h12l4 4v14H3V3zM7 3v6h10V3M7 21v-8h10v8',
  export: 'M12 3v12M7 8l5-5 5 5M4 14v7h16v-7',
  duplicate: 'M9 9h12v12H9zM15 9V3H3v12h6',
  forward: 'M8 8h12v12H8zM8 16H4V4h12v4',
  backward: 'M4 4h12v12H4zM16 8h4v12H8v-4',
  delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  cornerTopLeft: 'M4 20V9a5 5 0 015-5h11',
  cornerTopRight: 'M4 4h11a5 5 0 015 5v11',
  cornerBottomRight: 'M20 4v11a5 5 0 01-5 5H4',
  cornerBottomLeft: 'M20 20H9a5 5 0 01-5-5V4',
  paint: 'M12 3l8 8-8 8-8-8 8-8zM4 20h16M8 11h8',
  eyedropper: 'M14 4l6 6M4 20l5-1 10-10-4-4L5 16l-1 4zM13 5l6 6',
  snapGrid: 'M5 3v18M10 3v18M2 7h11M2 12h11M2 17h11M14 6h3a6 6 0 010 12h-3zM14 10h3a2 2 0 010 4h-3',
  directSelect: 'M19 3l-14 10 7 1 3 7z',
};
export type IconName = keyof typeof paths;
export function createIcon(name: IconName): SVGSVGElement {
  if (!paths[name]) throw new Error(`Unknown icon: ${name}`);
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: 'icon',
    'aria-hidden': 'true',
    focusable: 'false',
  }))
    icon.setAttribute(key, value);
  const path = document.createElementNS(icon.namespaceURI, 'path');
  path.setAttribute('d', paths[name]);
  icon.append(path);
  return icon;
}
export function mountIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    const name = el.dataset.icon;
    if (name && name in paths) el.replaceChildren(createIcon(name as IconName));
  });
}
