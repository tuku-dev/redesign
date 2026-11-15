import type { EditorStore } from '../editor/store.ts';
import movePicture from '../assets/cursors/move.svg?raw';
import pickerPicture from '../assets/cursors/picker.svg?raw';
import penPicture from '../assets/cursors/pen.svg?raw';
import pointerPicture from '../assets/cursors/pointer.svg?raw';
import rotatePicture from '../assets/cursors/rotate.svg?raw';
import textPicture from '../assets/cursors/text.svg?raw';

/** Cursor artwork lives in src/assets/cursors/*.svg (24x24); edit those files to restyle. */
const cursor = (source: string, x: number, y: number, fallback: string) => {
  const image = (size: number) =>
    `url("data:image/svg+xml,${encodeURIComponent(
      source.trim().replace('width="24" height="24"', `width="${size}" height="${size}"`),
    )}")`;
  // The 2x image keeps edges crisp on high-DPI screens instead of upscaling a 24px bitmap.
  return `image-set(${image(24)} 1x, ${image(48)} 2x) ${x} ${y}, ${fallback}`;
};

// Right-facing arrow, matching the direct-select tool icon.
export const pointerCursor = cursor(pointerPicture, 19, 3, 'default');
// Left-facing arrow, matching the move tool icon.
export const moveCursor = cursor(movePicture, 5, 3, 'default');
export const pickerCursor = cursor(pickerPicture, 4, 20, 'crosshair');
// Upright pen nib with its tip pointing straight up.
export const penCursor = cursor(penPicture, 12, 3, 'crosshair');
// Serif capital "I": one vertical line with a bar at the top and bottom.
export const textCursor = cursor(textPicture, 12, 12, 'text');
const rotationCursors = new Map<number, string>();
/** Point the curved arrow toward the selection, including rotated/flipped corners. */
export function rotateCursorAt(degrees: number): string {
  const angle = (((Math.round(degrees / 5) * 5) % 360) + 360) % 360;
  let value = rotationCursors.get(angle);
  if (!value) {
    const picture = rotatePicture.replace(
      /(<svg\b[^>]*>)([\s\S]*)(<\/svg>)/,
      `$1<g transform="rotate(${angle} 12 12)">$2</g>$3`,
    );
    value = cursor(picture, 12, 12, 'grab');
    rotationCursors.set(angle, value);
  }
  return value;
}
export const rotateCursor = rotateCursorAt(0);

export function toolCursor(store: EditorStore, pen = false): string {
  if (store.space || store.tool === 'hand') return 'grab';
  if (store.canvasColorMode) return pickerCursor;
  if (pen) return penCursor;
  if (store.tool === 'select') return moveCursor;
  if (store.tool === 'text') return textCursor;
  return 'crosshair';
}
