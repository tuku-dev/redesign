import type { DesignNode } from '../model/types.ts';
import { fillLayers, strokeLayers } from '../model/paint-layers.ts';
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
  const usesLayeredPaints = !!a && (a.fills !== undefined || a.strokes !== undefined);
  if (a) {
    if (a.blendMode && a.blendMode !== 'normal')
      group.setAttribute('style', `mix-blend-mode:${a.blendMode}`);
    if (a.blur || a.shadow.enabled) {
      const margin =
        a.blur * 2 +
        (a.shadow.enabled
          ? Math.max(Math.abs(a.shadow.x), Math.abs(a.shadow.y)) + a.shadow.blur * 2
          : 0) +
        Math.max(a.strokeWidth, ...strokeLayers(n).map((stroke) => stroke.width));
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
  const canFill = n.type !== 'path' || n.vector?.closed;
  if (!usesLayeredPaints && a) {
    shape.setAttribute('fill-opacity', String(a.fillOpacity ?? 1));
    shape.setAttribute('stroke-opacity', String(a.strokeOpacity ?? 1));
    shape.setAttribute('stroke', a.stroke);
    shape.setAttribute('stroke-width', String(a.strokeWidth));
    shape.setAttribute('stroke-linejoin', 'round');
    shape.setAttribute('stroke-linecap', 'round');
    if (a.strokeStyle === 'dashed')
      shape.setAttribute('stroke-dasharray', `${a.strokeWidth * 3} ${a.strokeWidth * 2}`);
    else if (a.strokeStyle === 'dotted')
      shape.setAttribute('stroke-dasharray', `0 ${a.strokeWidth * 2}`);
    if (a.gradient.enabled && canFill) {
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
    group.append(shape);
  } else {
    for (const layer of fillLayers(n)) {
      if (!canFill) break;
      const fill = shape.cloneNode(true) as SVGElement;
      fill.setAttribute('fill', layer.color);
      fill.setAttribute('fill-opacity', String(layer.opacity));
      fill.setAttribute('stroke', 'none');
      group.append(fill);
    }
  }
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
      opacity: i.opacity ?? 1,
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
  }
  if (!usesLayeredPaints && n.image && a?.strokeWidth) {
    const outline = shape.cloneNode(true) as SVGElement;
    outline.setAttribute('fill', 'none');
    group.append(outline);
  } else if (usesLayeredPaints) {
    for (const layer of strokeLayers(n)) {
      const stroke = shape.cloneNode(true) as SVGElement;
      stroke.setAttribute('fill', 'none');
      stroke.setAttribute('stroke', layer.color);
      stroke.setAttribute('stroke-opacity', String(layer.opacity));
      stroke.setAttribute('stroke-width', String(layer.width));
      stroke.setAttribute('stroke-linejoin', 'round');
      stroke.setAttribute('stroke-linecap', 'round');
      if (a?.strokeStyle === 'dashed')
        stroke.setAttribute('stroke-dasharray', `${layer.width * 3} ${layer.width * 2}`);
      else if (a?.strokeStyle === 'dotted')
        stroke.setAttribute('stroke-dasharray', `0 ${layer.width * 2}`);
      group.append(stroke);
    }
  }
  return group;
}
