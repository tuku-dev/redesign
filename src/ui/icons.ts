// Original outline icons on a shared 24px grid. Color follows the control state.
const paths = {
  pen: 'M3 21 6 10 14 4 20 10 14 18 3 21Z M3 21l7.5-7.5 M14 4l2-2 6 6-2 2 M13.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0',
  pencil: 'M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19zM14 7l3 3',
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
  line: 'M5 19L19 5',
  arrow: 'M5 19L19 5M9 5h10v10',
  polygon: 'M12 4l9 16H3z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  check: 'M5 12.5l4.5 4.5L19 7',
  star: 'M12 3L14.23 9.43L21.03 9.56L15.61 13.67L17.58 20.19L12 16.3L6.42 20.19L8.39 13.67L2.97 9.56L9.77 9.43Z',
  chevronUp: 'M6 15l6-6 6 6',
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
  alignLeft: 'M5 3v18M9 6h9M9 12h6M9 18h11',
  alignCenterX: 'M12 3v18M5 6h14M8 12h8M6 18h12',
  alignRight: 'M19 3v18M5 6h10M9 12h6M7 18h12',
  alignTop: 'M3 5h18M6 9v9M12 9v6M18 9v11',
  alignCenterY: 'M3 12h18M6 5v14M12 8v8M18 6v12',
  alignBottom: 'M3 19h18M6 5v10M12 9v6M18 7v12',
  distributeLeft: 'M4 4v16M8 6h4v4H8zM14 10h4v4h-4zM8 16h4v4H8z',
  distributeCenterX: 'M12 3v18M5 6h4v4H5zM15 10h4v4h-4zM5 16h4v4H5z',
  distributeRight: 'M20 4v16M12 6h4v4h-4zM6 10h4v4H6zM12 16h4v4h-4z',
  distributeTop: 'M4 4h16M6 8h4v4H6zM10 14h4v4h-4zM16 8h4v4h-4z',
  distributeCenterY: 'M3 12h18M6 5h4v4H6zM10 15h4v4h-4zM16 5h4v4h-4z',
  distributeBottom: 'M4 20h16M6 12h4v4H6zM10 6h4v4h-4zM16 12h4v4h-4z',
  justifyHorizontal: 'M5 4v16M19 4v16M9 7h6M8 12h8M9 17h6',
  justifyVertical: 'M4 5h16M4 19h16M7 9v6M12 8v8M17 9v6',
  paint: 'M12 3l8 8-8 8-8-8 8-8zM4 20h16M8 11h8',
  snapGrid: 'M5 3v18M10 3v18M2 7h11M2 12h11M2 17h11M14 6h3a6 6 0 010 12h-3zM14 10h3a2 2 0 010 4h-3',
  directSelect: 'M19 3l-14 10 7 1 3 7z',
};
/** Filled 32px glyphs; they follow the control color through fill instead of stroke. */
const solidPaths = {
  eyedropper:
    'M27.7,3.3c-1.5-1.5-3.9-1.5-5.4,0L17,8.6l-1.3-1.3c-0.4-0.4-1-0.4-1.4,0s-0.4,1,0,1.4l1.3,1.3L5,20.6c-0.6,0.6-1,1.4-1.1,2.3C3.3,23.4,3,24.2,3,25c0,1.7,1.3,3,3,3c0.8,0,1.6-0.3,2.2-0.9C9,27,9.8,26.6,10.4,26L21,15.4l1.3,1.3c0.2,0.2,0.5,0.3,0.7,0.3s0.5-0.1,0.7-0.3c0.4-0.4,0.4-1,0-1.4L22.4,14l5.3-5.3C29.2,7.2,29.2,4.8,27.7,3.3z M9,24.6c-0.4,0.4-0.8,0.6-1.3,0.5c-0.4,0-0.7,0.2-0.9,0.5C6.7,25.8,6.3,26,6,26c-0.6,0-1-0.4-1-1c0-0.3,0.2-0.7,0.5-0.8c0.3-0.2,0.5-0.5,0.5-0.9c0-0.5,0.2-1,0.5-1.3L17,11.4l2.6,2.6L9,24.6z',
};
export type IconName = keyof typeof paths | keyof typeof solidPaths;
export function createIcon(name: IconName): SVGSVGElement {
  const solid = name in solidPaths;
  const data = solid
    ? solidPaths[name as keyof typeof solidPaths]
    : paths[name as keyof typeof paths];
  if (!data) throw new Error(`Unknown icon: ${name}`);
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({
    viewBox: solid ? '0 0 32 32' : '0 0 24 24',
    fill: solid ? 'currentColor' : 'none',
    stroke: solid ? 'none' : 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: 'icon',
    'aria-hidden': 'true',
    focusable: 'false',
  }))
    icon.setAttribute(key, value);
  const path = document.createElementNS(icon.namespaceURI, 'path');
  path.setAttribute('d', data);
  icon.append(path);
  return icon;
}
export function mountIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    const name = el.dataset.icon;
    if (name && (name in paths || name in solidPaths))
      el.replaceChildren(createIcon(name as IconName));
  });
}
