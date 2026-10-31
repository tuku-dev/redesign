import { defaultAppearance } from '../../src/model/features.ts';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createNode } from '../../src/model/document.ts';
import type { DesignDocument } from '../../src/model/types.ts';
const seed = () => {
  const frame = createNode('frame', {
      id: 'screen-a',
      name: 'Screen A',
      x: 40,
      y: 40,
      width: 360,
      height: 300,
    }),
    a = createNode('rectangle', {
      id: 'rect-a',
      name: 'Card',
      x: 60,
      y: 60,
      width: 80,
      height: 40,
      parentId: frame.id,
    }),
    b = createNode('ellipse', {
      id: 'circle-b',
      name: 'Badge',
      x: 180,
      y: 60,
      width: 60,
      height: 60,
      parentId: frame.id,
    });
  return { ...createDocument(), nodes: [frame, a, b] };
};
async function open(page: Page, doc: DesignDocument = seed()) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((doc) => {
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      localStorage.setItem('redesign.document', JSON.stringify(doc));
      sessionStorage.setItem('seeded', 'true');
    }
  }, doc);
  await page.goto('/');
  await expect(page.locator('#layers .layer')).toHaveCount(doc.nodes.length);
  return errors;
}
const select = (page: Page, id: string) =>
  page.locator(`[data-layer-id="${id}"] .layer-select`).click();
const tools = (page: Page) => page.getByText('Tools & resources', { exact: true }).click();
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('redesign.document')!) as DesignDocument);
test('theme selector applies all three choices, survives reload, and follows system changes', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const errors = await open(page);
  await page.locator('#theme-select').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('#theme-select')).toHaveValue('dark');
  await page.locator('#theme-select').selectOption('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#theme-select').selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
});
test('auto layout controls arrange children and undo restores original positions', async ({
  page,
}) => {
  const errors = await open(page);
  await select(page, 'screen-a');
  await page.getByRole('button', { name: 'Add auto layout', exact: true }).click();
  await expect(page.getByLabel('Direction', { exact: true })).toBeVisible();
  await page.getByLabel('Gap', { exact: true }).fill('24');
  await page.getByLabel('Gap', { exact: true }).press('Tab');
  await page.getByLabel('Direction', { exact: true }).selectOption('vertical');
  const doc = await saved(page),
    a = doc.nodes.find((n) => n.id === 'rect-a')!,
    b = doc.nodes.find((n) => n.id === 'circle-b')!;
  expect(a.y).toBe(56);
  expect(b.y).toBe(120);
  await page.locator('#undo').click();
  await select(page, 'screen-a');
  await expect(page.getByLabel('Direction', { exact: true })).toHaveValue('horizontal');
  expect(errors).toEqual([]);
});
test('component controls create linked instances, preserve overrides and detach', async ({
  page,
}) => {
  const errors = await open(page);
  await select(page, 'screen-a');
  await page.getByRole('button', { name: 'Create component', exact: true }).click();
  await page.getByRole('button', { name: 'Create instance', exact: true }).click();
  let doc = await saved(page);
  const instance = doc.nodes.find((n) => n.component?.kind === 'instance')!,
    copy = doc.nodes.find((n) => n.instanceSource === 'rect-a')!;
  await select(page, 'rect-a');
  await page.getByLabel('Fill', { exact: true }).fill('#ff0000');
  doc = await saved(page);
  expect(doc.nodes.find((n) => n.id === copy.id)?.fill).toBe('#ff0000');
  await select(page, instance.id);
  await page.getByRole('button', { name: 'Detach instance', exact: true }).click();
  doc = await saved(page);
  expect(doc.nodes.find((n) => n.id === instance.id)?.component).toBeUndefined();
  expect(errors).toEqual([]);
});
test('image picker decodes a raster, exposes crop controls and exports embedded image data', async ({
  page,
}) => {
  const errors = await open(page);
  await tools(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Insert image', exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByLabel('Image fit', { exact: true })).toBeVisible();
  await page.getByLabel('Image fit', { exact: true }).selectOption('contain');
  await page.getByLabel('Crop X (0–1)', { exact: true }).fill('.2');
  await page.getByLabel('Crop X (0–1)', { exact: true }).press('Tab');
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  const svg = await readFile((await (await download).path())!, 'utf8');
  expect(svg).toContain('data:image/png;base64,');
  expect(svg).toContain('<image');
  expect(errors).toEqual([]);
});
test('rulers, editable guides and frame layout grids render without entering SVG exports', async ({
  page,
}) => {
  const errors = await open(page);
  await tools(page);
  await page.getByRole('button', { name: 'Show rulers', exact: true }).click();
  await expect(page.locator('[data-ruler-axis]')).toHaveCount(2);
  await page.getByLabel('Guide position', { exact: true }).fill('120');
  await page.getByLabel('Guide position', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Add guide', exact: true }).click();
  await expect(page.locator('[data-guide]')).toHaveCount(1);
  await select(page, 'screen-a');
  await page.getByLabel('Show layout grid', { exact: true }).check();
  await page.getByLabel('Grid count', { exact: true }).fill('4');
  await page.getByLabel('Grid count', { exact: true }).press('Tab');
  const doc = await saved(page);
  expect(doc.nodes[0].layoutGrid?.count).toBe(4);
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  const svg = await readFile((await (await download).path())!, 'utf8');
  expect(svg).not.toContain('data-guide');
  expect(svg).not.toContain('data-ruler');
  expect(errors).toEqual([]);
});
test('gradient, stroke, shadow and blur are rendered and exported', async ({ page }) => {
  const errors = await open(page);
  await select(page, 'rect-a');
  await page.getByLabel('Gradient fill', { exact: true }).check();
  await page.getByLabel('Gradient end', { exact: true }).fill('#00ff00');
  await page.getByLabel('Stroke width', { exact: true }).fill('3');
  await page.getByLabel('Stroke width', { exact: true }).press('Tab');
  await page.getByLabel('Drop shadow', { exact: true }).check();
  await page.getByLabel('Layer blur', { exact: true }).fill('2');
  await page.getByLabel('Layer blur', { exact: true }).press('Tab');
  await expect(page.locator('#scene linearGradient')).toHaveCount(1);
  await expect(page.locator('#scene feDropShadow')).toHaveCount(1);
  await expect(page.locator('#scene feGaussianBlur')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  const svg = await readFile((await (await download).path())!, 'utf8');
  expect(svg).toContain('linearGradient');
  expect(svg).toContain('feDropShadow');
  expect(svg).toContain('stroke-width="3"');
  expect(errors).toEqual([]);
});
test('pen tool creates a closed path, points can be edited, and booleans produce geometry', async ({
  page,
}) => {
  const errors = await open(page, { ...createDocument(), nodes: [] });
  await tools(page);
  await page.getByRole('button', { name: 'Pen tool', exact: true }).click();
  const box = (await page.locator('#canvas').boundingBox())!;
  for (const [x, y] of [
    [200, 180],
    [300, 180],
    [300, 280],
  ])
    await page.mouse.click(box.x + x, box.y + y);
  await page.keyboard.press('Shift+Enter');
  await expect(page.locator('#layers .layer')).toHaveCount(1);
  let doc = await saved(page);
  expect(doc.nodes[0].vector?.closed).toBe(true);
  await page.getByLabel('Path 1 point 2 x', { exact: true }).fill('.8');
  await page.getByLabel('Path 1 point 2 x', { exact: true }).press('Tab');
  doc = await saved(page);
  expect(doc.nodes[0].vector?.rings[0][1].x).toBe(0.8);
  await page.locator('#add').click();
  await page.locator('#canvas').focus();
  await page.keyboard.press('Control+a');
  await page.getByRole('button', { name: 'Union', exact: true }).click();
  await expect(page.locator('#layers .layer')).toHaveCount(1);
  await page.locator('#undo').click();
  await expect(page.locator('#layers .layer')).toHaveCount(2);
  expect(errors).toEqual([]);
});
test('multiple pages can be created, renamed, switched, duplicated and saved/reopened', async ({
  page,
}) => {
  const errors = await open(page);
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await expect(page.locator('#layers .layer')).toHaveCount(0);
  await page.getByLabel('Page name', { exact: true }).fill('Second page');
  await page.getByLabel('Page name', { exact: true }).press('Tab');
  await page.locator('#add').click();
  await page.getByRole('button', { name: 'Duplicate page', exact: true }).click();
  await expect(page.getByLabel('Page name', { exact: true })).toHaveValue('Second page copy');
  await page.getByLabel('Page', { exact: true }).selectOption('page-1');
  await expect(page.locator('#layers .layer')).toHaveCount(3);
  const download = page.waitForEvent('download');

  await page.locator('#save-as').click();
  await page
    .getByRole('dialog', { name: 'Download a copy' })
    .getByRole('textbox', { name: 'File name' })
    .fill('Saved project');
  await page.getByRole('button', { name: 'Download copy', exact: true }).last().click();
  const data = await readFile((await (await download).path())!, 'utf8');
  expect(JSON.parse(data).workspace.pages).toHaveLength(3);
  await page.locator('#file').setInputFiles({
    name: 'saved.redesign',
    mimeType: 'application/json',
    buffer: Buffer.from(data),
  });
  await expect(page.getByLabel('Page', { exact: true }).locator('option')).toHaveCount(3);
  expect(errors).toEqual([]);
});
test('prototype controls connect screens and preview supports navigation, back and close', async ({
  page,
}) => {
  const doc = seed(),
    next = createNode('frame', {
      id: 'screen-b',
      name: 'Screen B',
      x: 500,
      y: 40,
      width: 360,
      height: 300,
    });
  doc.nodes.push(next);
  const errors = await open(page, doc);
  await select(page, 'rect-a');
  await page.getByLabel('On click →', { exact: true }).selectOption('screen-b');
  await page.getByLabel('Transition', { exact: true }).selectOption('dissolve');
  await select(page, 'screen-a');
  await tools(page);
  await page.getByRole('button', { name: 'Present prototype', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Prototype preview' });
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-id="rect-a"]').click();
  await expect(dialog.locator('strong')).toHaveText('Screen B');
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog.locator('strong')).toHaveText('Screen A');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('ruler drag creates a guide, guide dragging moves it and Escape cancels another drag', async ({
  page,
}) => {
  const errors = await open(page);
  await tools(page);
  await page.getByRole('button', { name: 'Show rulers', exact: true }).click();
  const box = (await page.locator('#canvas').boundingBox())!;
  await page.mouse.move(box.x + 250, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 150, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('[data-guide]')).toHaveCount(1);
  let doc = await saved(page);
  const first = doc.workspace!.guides[0].position;
  expect(first).toBe(220);
  await page.mouse.move(box.x + 300, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 340, box.y + 200, { steps: 4 });
  await page.mouse.up();
  doc = await saved(page);
  expect(doc.workspace!.guides[0].position).toBe(260);
  await page.mouse.move(box.x + 340, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 380, box.y + 200);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  doc = await saved(page);
  expect(doc.workspace!.guides[0].position).toBe(260);
  expect(errors).toEqual([]);
});
test('vector handles drag outside the initial box and create one undoable edit', async ({
  page,
}) => {
  const vector = createNode('path', {
    id: 'vector',
    x: 100,
    y: 100,
    width: 100,
    height: 100,
    vector: {
      closed: true,
      rings: [
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
      ],
    },
  });
  const errors = await open(page, { ...createDocument(), nodes: [vector] });
  await select(page, 'vector');
  await tools(page);
  await page.getByRole('button', { name: 'Edit points', exact: true }).click();
  const handle = page.locator('[data-vector-ring="0"][data-vector-point="2"]'),
    box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  let doc = await saved(page);
  expect(doc.nodes[0].width).toBe(150);
  expect(doc.nodes[0].height).toBe(130);
  await page.locator('#undo').click();
  doc = await saved(page);
  expect(doc.nodes[0].width).toBe(100);
  expect(errors).toEqual([]);
});
test('dropping an image creates a layer at the drop position', async ({ page }) => {
  const errors = await open(page, { ...createDocument(), nodes: [] });
  const transfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer(),
      bytes = Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=',
        ),
        (c) => c.charCodeAt(0),
      );
    dt.items.add(new File([bytes], 'pixel.png', { type: 'image/png' }));
    return dt;
  });
  const box = (await page.locator('#canvas').boundingBox())!;
  await page
    .locator('#canvas')
    .dispatchEvent('drop', { dataTransfer: transfer, clientX: box.x + 200, clientY: box.y + 200 });
  await expect(page.locator('#layers .layer')).toHaveCount(1);
  const doc = await saved(page);
  expect(doc.nodes[0].x).toBe(120);
  expect(doc.nodes[0].y).toBe(120);
  expect(doc.nodes[0].image?.src).toContain('data:image/png');
  expect(errors).toEqual([]);
});
test('dark editor visual fixture includes new tools and appearance controls', async ({
  page,
}, testInfo) => {
  const errors = await open(page);
  await select(page, 'rect-a');
  await page.locator('#theme-select').selectOption('dark');
  await tools(page);
  await page.getByLabel('Gradient fill', { exact: true }).check();
  await page.screenshot({ path: testInfo.outputPath('editor-dark.png'), fullPage: true });
  expect(errors).toEqual([]);
});
test('pen is visible in the main toolbar with resources collapsed and switches back to other tools', async ({
  page,
}) => {
  const errors = await open(page, { ...createDocument(), nodes: [] });
  const pen = page.getByRole('button', { name: 'Pen tool', exact: true });
  await expect(pen).toBeVisible();
  await expect(page.locator('#workspace-tools')).not.toBeVisible();
  await pen.click();
  await expect(pen).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Move tool', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.keyboard.press('Escape');
  await expect(pen).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Move tool', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await pen.click();
  await page.getByRole('button', { name: 'Rectangle tool', exact: true }).click();
  await expect(pen).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Rectangle tool', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(errors).toEqual([]);
});
test('dragging pen anchors creates cubic curves that survive save/open and SVG export', async ({
  page,
}, testInfo) => {
  const errors = await open(page, { ...createDocument(), nodes: [] });
  await page.getByRole('button', { name: 'Pen tool', exact: true }).click();
  const box = (await page.locator('#canvas').boundingBox())!;
  await page.mouse.move(box.x + 180, box.y + 260);
  await page.mouse.down();
  await page.mouse.move(box.x + 230, box.y + 180, { steps: 6 });
  await page.mouse.up();
  await page.mouse.move(box.x + 380, box.y + 260);
  await page.mouse.down();
  await page.mouse.move(box.x + 430, box.y + 340, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press('Enter');
  await expect(page.locator('#scene path:not([data-vector-hit])')).toHaveAttribute('d', /C /);
  let doc = await saved(page);
  expect(doc.nodes[0].vector?.rings[0][0].out).toBeDefined();
  expect(doc.nodes[0].vector?.rings[0][1].in).toBeDefined();
  expect(doc.nodes[0].height).toBeGreaterThan(20);
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  const svg = await readFile((await (await download).path())!, 'utf8');
  expect(svg).toMatch(/d="M [^"]*C /);
  const savedDoc = JSON.stringify(doc);
  await page.locator('#file').setInputFiles({
    name: 'curves.redesign',
    mimeType: 'application/json',
    buffer: Buffer.from(savedDoc),
  });
  await expect(page.locator('#scene path:not([data-vector-hit])')).toHaveAttribute('d', /C /);
  doc = await saved(page);
  await select(page, doc.nodes[0].id);
  await tools(page);
  await page.getByRole('button', { name: 'Edit points', exact: true }).click();
  await expect(page.locator('[data-vector-handle]')).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath('pen-curves.png'), fullPage: true });
  expect(errors).toEqual([]);
});
test('Bezier handles can be dragged, Alt-dragged independently, canceled and undone', async ({
  page,
}) => {
  const vector = createNode('path', {
    id: 'curve',
    x: 120,
    y: 140,
    width: 200,
    height: 120,
    vector: {
      closed: false,
      rings: [
        [
          { x: 0, y: 1, in: { x: -0.25, y: 1 }, out: { x: 0.25, y: 1 }, smooth: true },
          { x: 1, y: 1, in: { x: 0.75, y: 0 }, out: { x: 1.25, y: 2 }, smooth: true },
        ],
      ],
    },
  });
  const errors = await open(page, { ...createDocument(), nodes: [vector] });
  await select(page, 'curve');
  await tools(page);
  await page.getByRole('button', { name: 'Edit points', exact: true }).click();
  const handle = page.locator(
    '[data-vector-ring="0"][data-vector-point="0"][data-vector-handle="out"]',
  );
  let box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 - 40, { steps: 6 });
  await page.mouse.up();
  let doc = await saved(page),
    n = doc.nodes[0],
    p = n.vector!.rings[0][0];
  expect(p.out!.y).toBeLessThan(p.y);
  expect(p.in!.y).toBeGreaterThan(p.y);
  const before = structuredClone(doc);
  box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 - 10);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(await saved(page)).toEqual(before);
  const opposite = { x: n.x + p.in!.x * n.width, y: n.y + p.in!.y * n.height };
  box = (await handle.boundingBox())!;
  await page.keyboard.down('Alt');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 25, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  doc = await saved(page);
  n = doc.nodes[0];
  p = n.vector!.rings[0][0];
  expect(p.smooth).toBe(false);
  expect(n.x + p.in!.x * n.width).toBeCloseTo(opposite.x);
  expect(n.y + p.in!.y * n.height).toBeCloseTo(opposite.y);
  await page.locator('#undo').click();
  expect(await saved(page)).toEqual(before);
  expect(errors).toEqual([]);
});
test('existing corner points can be converted to smooth curves and back', async ({ page }) => {
  const vector = createNode('path', {
    id: 'corners',
    x: 100,
    y: 100,
    width: 180,
    height: 120,
    vector: {
      closed: false,
      rings: [
        [
          { x: 0, y: 1 },
          { x: 0.5, y: 0 },
          { x: 1, y: 1 },
        ],
      ],
    },
  });
  const errors = await open(page, { ...createDocument(), nodes: [vector] });
  await select(page, 'corners');
  await page.getByRole('button', { name: 'Path 1 point 2: Smooth', exact: true }).click();
  await expect(page.locator('#scene path:not([data-vector-hit])')).toHaveAttribute('d', /C /);
  let doc = await saved(page);
  expect(doc.nodes[0].vector?.rings[0][1].smooth).toBe(true);
  await page.getByRole('button', { name: 'Path 1 point 2: Corner', exact: true }).click();
  await expect(page.locator('#scene path:not([data-vector-hit])')).not.toHaveAttribute('d', /C /);
  doc = await saved(page);
  expect(doc.nodes[0].vector?.rings[0][1].out).toBeUndefined();
  expect(errors).toEqual([]);
});
test('two dragged curve anchors can close a curved loop without an extra corner', async ({
  page,
}) => {
  const errors = await open(page, { ...createDocument(), nodes: [] });
  await page.getByRole('button', { name: 'Pen tool', exact: true }).click();
  const box = (await page.locator('#canvas').boundingBox())!;
  for (const [x, y, dx, dy] of [
    [180, 260, 50, -80],
    [380, 260, 50, 80],
  ]) {
    await page.mouse.move(box.x + x, box.y + y);
    await page.mouse.down();
    await page.mouse.move(box.x + x + dx, box.y + y + dy, { steps: 5 });
    await page.mouse.up();
  }
  await page.mouse.click(box.x + 180, box.y + 260);
  const doc = await saved(page);
  expect(doc.nodes[0].vector?.closed).toBe(true);
  expect(doc.nodes[0].vector?.rings[0]).toHaveLength(2);
  const d = await page.locator('#scene path:not([data-vector-hit])').getAttribute('d');
  expect(d?.match(/C /g)).toHaveLength(2);
  expect(d).toMatch(/Z$/);
  expect(errors).toEqual([]);
});
test('double-clicking a pen shape enters point editing and anchors drag without moving the whole shape', async ({
  page,
}) => {
  const vector = createNode('path', {
    id: 'editable-path',
    x: 120,
    y: 120,
    width: 200,
    height: 180,
    vector: {
      closed: true,
      rings: [
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
      ],
    },
  });
  const errors = await open(page, { ...createDocument(), nodes: [vector] });
  const box = (await page.locator('#canvas').boundingBox())!;
  await page.mouse.dblclick(box.x + 280, box.y + 280, { delay: 90 });
  await expect(page.locator('[data-vector-anchor]')).toHaveCount(4);
  const before = await saved(page),
    handle = page.locator('[data-vector-anchor][data-vector-ring="0"][data-vector-point="2"]'),
    anchor = (await handle.boundingBox())!;
  await page.mouse.move(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2);
  await page.mouse.down();
  await page.mouse.move(anchor.x + anchor.width / 2 + 40, anchor.y + anchor.height / 2 + 20, {
    steps: 6,
  });
  await page.mouse.up();
  const after = await saved(page);
  expect(after.nodes[0].width).toBe(240);
  expect(after.nodes[0].height).toBe(200);
  expect(after.nodes[0].x).toBe(before.nodes[0].x);
  expect(after.nodes[0].y).toBe(before.nodes[0].y);
  expect(errors).toEqual([]);
});
test('selected vectors enter point editing with Enter or the visible action and exit with Escape or Done', async ({
  page,
}) => {
  const vector = createNode('path', {
    id: 'keyboard-vector',
    x: 120,
    y: 120,
    width: 200,
    height: 180,
    vector: {
      closed: true,
      rings: [
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
      ],
    },
  });
  const errors = await open(page, { ...createDocument(), nodes: [vector] });
  await select(page, vector.id);
  await page.keyboard.press('Enter');
  await expect(page.locator('#canvas')).toHaveAttribute('data-vector-editing', '');
  await expect(page.locator('[data-vector-anchor]')).toHaveCount(3);
  await expect(page.locator('[data-resize]')).toHaveCount(0);
  await expect(page.locator('.vector-edit-bar')).toContainText('Editing vector');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-vector-anchor]')).toHaveCount(0);
  await expect(page.locator('[data-resize]')).toHaveCount(8);
  await page.getByRole('button', { name: 'Edit vector', exact: true }).click();
  await expect(page.locator('[data-vector-anchor]')).toHaveCount(3);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('[data-vector-anchor]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('double-clicking a reopened curved stroke exposes anchors and tangent handles', async ({
  page,
}) => {
  const vector = createNode('path', {
    id: 'reopened-curve',
    appearance: { ...defaultAppearance(), strokeWidth: 2 },
    x: 120,
    y: 120,
    width: 200,
    height: 150,
    vector: {
      closed: false,
      rings: [
        [
          { x: 0, y: 1, out: { x: 0, y: 0 } },
          { x: 1, y: 1, in: { x: 1, y: 0 } },
        ],
      ],
    },
  });
  const errors = await open(page, { ...createDocument(), nodes: [] });
  await page.locator('#file').setInputFiles({
    name: 'Curve project.redesign',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...createDocument(), nodes: [vector] })),
  });
  const box = (await page.locator('#canvas').boundingBox())!;
  await page.mouse.dblclick(box.x + 300, box.y + 237.5, { delay: 90 });
  await expect(page.locator('[data-vector-anchor]')).toHaveCount(2);
  await expect(page.locator('[data-vector-handle]')).toHaveCount(2);
  expect(errors).toEqual([]);
});
test('double-clicking an anchor converts it once between corner and smooth', async ({ page }) => {
  const vector = createNode('path', {
    id: 'anchor-convert',
    x: 120,
    y: 120,
    width: 200,
    height: 180,
    vector: {
      closed: false,
      rings: [
        [
          { x: 0, y: 1 },
          { x: 0.5, y: 0 },
          { x: 1, y: 1 },
        ],
      ],
    },
  });
  const errors = await open(page, { ...createDocument(), nodes: [vector] });
  await select(page, vector.id);
  await page.keyboard.press('Enter');
  const anchor = page.locator('[data-vector-anchor][data-vector-ring="0"][data-vector-point="1"]');
  let box = (await anchor.boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2, { delay: 90 });
  await expect(page.locator('[data-vector-handle]')).toHaveCount(2);
  expect((await saved(page)).nodes[0].vector?.rings[0][1].smooth).toBe(true);
  box = (await anchor.boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2, { delay: 90 });
  await expect(page.locator('[data-vector-handle]')).toHaveCount(0);
  expect((await saved(page)).nodes[0].vector?.rings[0][1].smooth).toBe(false);
  expect(errors).toEqual([]);
});
