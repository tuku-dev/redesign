import type { DesignNode } from '../model/types.ts';
import { svg } from './svg.ts';
let sequence = 0;
/** Paint definitions are self-contained so they survive SVG export and clipboard rendering. */
export function paintShape(shape: SVGElement, n: DesignNode): SVGElement {
  const a = n.appearance;
  if (!a && !n.image) return shape;
  const id = `paint-${sequence++}`,
    group = svg('g', { 'data-id': n.id, opacity: n.opacity }),
    defs = svg('defs');
  group.append(defs);
  shape.removeAttribute('opacity');
  if (a) {
    shape.setAttribute('stroke', a.stroke);
    shape.setAttribute('stroke-width', String(a.strokeWidth));
    shape.setAttribute('stroke-linejoin', 'round');
    shape.setAttribute('stroke-linecap', 'round');
    if (a.gradient.enabled && (n.type !== 'path' || n.vector?.closed)) {
      const radians = (a.gradient.angle * Math.PI) / 180,
        dx = Math.cos(radians) / 2,
        dy = Math.sin(radians) / 2;
      const gradient = svg('linearGradient', {
        id: id + '-gradient',
        x1: 0.5 - dx,
        y1: 0.5 - dy,
        x2: 0.5 + dx,
        y2: 0.5 + dy,
      });
      gradient.append(
        svg('stop', { offset: 0, 'stop-color': n.fill }),
        svg('stop', { offset: 1, 'stop-color': a.gradient.end }),
      );
      defs.append(gradient);
      shape.setAttribute('fill', `url(#${id}-gradient)`);
    }
    if (a.blur || a.shadow.enabled) {
      const margin =
        a.blur * 2 +
        (a.shadow.enabled
          ? Math.max(Math.abs(a.shadow.x), Math.abs(a.shadow.y)) + a.shadow.blur * 2
          : 0) +
        a.strokeWidth;
      const filter = svg('filter', {
        id: id + '-filter',
        filterUnits: 'userSpaceOnUse',
        x: n.x - margin,
        y: n.y - margin,
        width: n.width + margin * 2,
        height: n.height + margin * 2,
        'color-interpolation-filters': 'sRGB',
      });
      if (a.blur) filter.append(svg('feGaussianBlur', { stdDeviation: a.blur / 2 }));
      if (a.shadow.enabled)
        filter.append(
          svg('feDropShadow', {
            dx: a.shadow.x,
            dy: a.shadow.y,
            stdDeviation: a.shadow.blur / 2,
            'flood-color': a.shadow.color,
            'flood-opacity': a.shadow.opacity,
          }),
        );
      defs.append(filter);
      group.setAttribute('filter', `url(#${id}-filter)`);
    }
  }
  group.append(shape);
  if (n.image) {
    const i = n.image,
      adjustments = { brightness: 100, contrast: 100, saturation: 100, ...i.adjustments },
      clip = svg('clipPath', { id: id + '-clip', clipPathUnits: 'userSpaceOnUse' }),
      mask = shape.cloneNode(true) as SVGElement;
    mask.removeAttribute('data-id');
    mask.removeAttribute('opacity');
    mask.setAttribute('fill', '#000000');
    mask.setAttribute('stroke', 'none');
    clip.append(mask);
    defs.append(clip);
    let w = n.width,
      h = n.height;
    if (i.fit !== 'stretch') {
      const scale = (i.fit === 'cover' ? Math.max : Math.min)(
        n.width / i.naturalWidth,
        n.height / i.naturalHeight,
      );
      w = i.naturalWidth * scale;
      h = i.naturalHeight * scale;
    }
    const image = svg('image', {
      href: i.src,
      x: n.x + (n.width - w) * i.focalX,
      y: n.y + (n.height - h) * i.focalY,
      width: w,
      height: h,
      preserveAspectRatio: 'none',
      'clip-path': `url(#${id}-clip)`,
      opacity: 1,
      'data-id': n.id,
    });
    if (
      adjustments.brightness !== 100 ||
      adjustments.contrast !== 100 ||
      adjustments.saturation !== 100
    ) {
      const filter = svg('filter', {
        id: id + '-image-adjustments',
        filterUnits: 'userSpaceOnUse',
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height,
        'color-interpolation-filters': 'sRGB',
      });
      const brightness = adjustments.brightness / 100,
        contrast = adjustments.contrast / 100,
        channel = {
          type: 'linear',
          slope: brightness * contrast,
          intercept: (brightness * (1 - contrast)) / 2,
        },
        transfer = svg('feComponentTransfer');
      transfer.append(svg('feFuncR', channel), svg('feFuncG', channel), svg('feFuncB', channel));
      filter.append(transfer);
      if (adjustments.saturation !== 100)
        filter.append(
          svg('feColorMatrix', {
            type: 'saturate',
            values: adjustments.saturation / 100,
          }),
        );
      defs.append(filter);
      image.setAttribute('filter', `url(#${id}-image-adjustments)`);
    }
    group.append(image);
    if (a?.strokeWidth) {
      const outline = shape.cloneNode(true) as SVGElement;
      outline.setAttribute('fill', 'none');
      group.append(outline);
    }
  }
  return group;
}
