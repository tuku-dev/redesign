import type { EditorElements } from './elements.ts';
import type { EditorStore } from '../editor/store.ts';
import type { ViewportController } from '../editor/viewport.ts';
import type { Notify } from './notifications.ts';
import type { ImageFill } from '../model/features.ts';
import { FeatureCommands } from '../commands/features.ts';
import { errorMessage } from './elements.ts';
const supported = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
export async function readImage(file: File): Promise<ImageFill> {
  if (!supported.has(file.type)) throw new Error('Choose a PNG, JPEG, WebP or GIF image.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Images must be 8 MB or smaller.');
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.readAsDataURL(file);
  });
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Could not decode image.'));
    img.src = src;
  });
  return {
    src,
    fit: 'cover',
    focalX: 0.5,
    focalY: 0.5,
    naturalWidth: size.width,
    naturalHeight: size.height,
  };
}
export function bindImages(
  el: EditorElements,
  store: EditorStore,
  viewport: ViewportController,
  notify: Notify,
): { insert: () => void; fill: () => void } {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp,image/gif';
  input.hidden = true;
  document.body.append(input);
  let asFill = false;
  input.addEventListener('change', () => {
    const file = input.files?.[0],
      fill = asFill;
    input.value = '';
    if (!file) return;
    const page = store.doc.workspace?.activePageId;
    void readImage(file)
      .then((image) => {
        if (store.doc.workspace?.activePageId !== page)
          throw new Error('Page changed. Please choose the image again.');
        const commands = new FeatureCommands(store);
        if (fill) commands.image(image);
        else {
          const r = el.canvas.getBoundingClientRect();
          const point = viewport.point({ x: r.width / 2, y: r.height / 2 }, { x: 0, y: 0 });
          const scale = Math.min(1, 800 / image.naturalWidth, 800 / image.naturalHeight);
          commands.insertImage(
            image,
            {
              width: Math.max(1, image.naturalWidth * scale),
              height: Math.max(1, image.naturalHeight * scale),
            },
            point,
          );
        }
      })
      .catch((error) => notify(errorMessage(error)));
  });
  el.canvas.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });
  el.canvas.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.files.length) return;
    e.preventDefault();
    const r = el.canvas.getBoundingClientRect(),
      point = viewport.point({ x: e.clientX, y: e.clientY }, { x: r.left, y: r.top }),
      page = store.doc.workspace?.activePageId;
    const files = [...e.dataTransfer.files];
    void (async () => {
      for (const [index, file] of files.entries()) {
        const image = await readImage(file);
        if (store.doc.workspace?.activePageId !== page)
          throw new Error('Page changed. Drop the images again.');
        const scale = Math.min(1, 800 / image.naturalWidth, 800 / image.naturalHeight);
        new FeatureCommands(store).insertImage(
          image,
          {
            width: Math.max(1, image.naturalWidth * scale),
            height: Math.max(1, image.naturalHeight * scale),
          },
          { x: point.x + index * 24, y: point.y + index * 24 },
        );
      }
    })().catch((error) => notify(errorMessage(error)));
  });
  return {
    insert: () => {
      asFill = false;
      input.click();
    },
    fill: () => {
      if (!store.chosen().some((n) => ['frame', 'rectangle', 'ellipse'].includes(n.type)))
        return notify('Select a frame, rectangle or ellipse for an image fill.');
      asFill = true;
      input.click();
    },
  };
}
