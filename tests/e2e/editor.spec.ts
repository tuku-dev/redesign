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
test('clicking a child selects it and right-clicking frame background selects the frame', async ({
  page,
}) => {
  const errors = await open(page);
  await page.locator('#scene [data-id="rect-a"]').first().click();
  await expect(page.locator('#layers .layer.active')).toHaveAttribute('data-layer-id', 'rect-a');
  const box = await page.locator('#scene rect[data-id="screen-a"]').first().boundingBox();
  if (!box) throw new Error('Frame shape is not visible.');
  await page.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.9, { button: 'right' });
  await expect(page.locator('#layers .layer.active')).toHaveAttribute('data-layer-id', 'screen-a');
  expect(errors).toEqual([]);
});
test('dragging on a frame background marquee-selects nested layers', async ({ page }) => {
  const errors = await open(page),
    frame = page.locator('#scene rect[data-id="screen-a"]').first(),
    box = await frame.boundingBox();
  if (!box) throw new Error('Frame shape is not visible.');
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#layers .layer.active')).toHaveCount(2);
  await expect(page.locator('#layers .layer.active[data-layer-id="screen-a"]')).toHaveCount(0);
  await expect(page.locator('#layers .layer.active[data-layer-id="rect-a"]')).toHaveCount(1);
  await expect(page.locator('#layers .layer.active[data-layer-id="circle-b"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});
test('Shift-drag moves selected nested objects in a straight line', async ({ page }) => {
  const errors = await open(page),
    frame = page.locator('#scene rect[data-id="screen-a"]').first(),
    frameBox = await frame.boundingBox();
  if (!frameBox) throw new Error('Frame shape is not visible.');
  await page.mouse.move(frameBox.x + frameBox.width * 0.8, frameBox.y + frameBox.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(frameBox.x + frameBox.width * 0.2, frameBox.y + frameBox.height * 0.2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(page.locator('#layers .layer.active')).toHaveCount(2);
  const rect = page.locator('#scene rect[data-id="rect-a"]').first(),
    rectBox = await rect.boundingBox();
  if (!rectBox) throw new Error('Nested rectangle is not visible.');
  await page.keyboard.down('Shift');
  await page.mouse.move(rectBox.x + 20, rectBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(rectBox.x + 80, rectBox.y + 55, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  const doc = await saved(page),
    card = doc.nodes.find((node) => node.id === 'rect-a')!,
    badge = doc.nodes.find((node) => node.id === 'circle-b')!;
  expect(card.x).toBe(120);
  expect(card.y).toBe(60);
  expect(badge.x).toBe(240);
  expect(badge.y).toBe(60);
  expect(errors).toEqual([]);
});
test('layers can be reordered by dragging within a parent and undone', async ({ page }) => {
  const errors = await open(page);
  await page
    .locator('[data-layer-id="rect-a"]')
    .dragTo(page.locator('[data-layer-id="circle-b"]'), { targetPosition: { x: 30, y: 2 } });
  await expect
    .poll(async () =>
      (await saved(page)).nodes
        .filter((node) => node.parentId === 'screen-a')
        .map((node) => node.id),
    )
    .toEqual(['circle-b', 'rect-a']);
  await expect(
    page
      .locator('#layers .layer')
      .evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.layerId)),
  ).resolves.toEqual(['screen-a', 'rect-a', 'circle-b']);
  await page.locator('#undo').click();
  await expect
    .poll(async () =>
      (await saved(page)).nodes
        .filter((node) => node.parentId === 'screen-a')
        .map((node) => node.id),
    )
    .toEqual(['rect-a', 'circle-b']);
  expect(errors).toEqual([]);
});
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
test('multi-selection exposes icon alignment and justification controls', async ({ page }) => {
  const doc = seed(),
    circle = doc.nodes.find((node) => node.id === 'circle-b')!;
  circle.y = 140;
  doc.nodes.push(
    createNode('rectangle', {
      id: 'rect-c',
      name: 'Card C',
      x: 300,
      y: 260,
      width: 50,
      height: 40,
      parentId: 'screen-a',
    }),
  );
  const errors = await open(page, doc);
  await select(page, 'rect-a');
  await page.locator('[data-layer-id="circle-b"] .layer-select').click({ modifiers: ['Shift'] });
  await page.locator('[data-layer-id="rect-c"] .layer-select').click({ modifiers: ['Shift'] });
  const controls = page.locator('.alignment-controls'),
    alignGroup = controls.nth(0),
    distributeGroup = controls.nth(1);
  await expect(page.getByRole('heading', { name: 'Align', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Align Objects' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Distribute Objects' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Distribute Spacing' })).toBeVisible();
  await expect(alignGroup.getByRole('button')).toHaveCount(6);
  await expect(distributeGroup.getByRole('button')).toHaveCount(6);
  for (const label of [
    'Align left',
    'Align horizontal centers',
    'Align right',
    'Align top',
    'Align vertical centers',
    'Align bottom',
    'Distribute left edges',
    'Distribute horizontal centers',
    'Distribute right edges',
    'Distribute top edges',
    'Distribute vertical centers',
    'Distribute bottom edges',
    'Distribute horizontal spacing',
    'Distribute vertical spacing',
  ]) {
    const button = page.getByRole('button', { name: label, exact: true });
    await expect(button).toBeVisible();
    await expect(button.locator('svg.icon')).toHaveCount(1);
    await expect(button).toHaveText('');
  }
  await page.getByRole('button', { name: 'Distribute horizontal centers' }).click();
  let savedDoc = await saved(page);
  expect(savedDoc.nodes.find((node) => node.id === 'circle-b')?.x).toBe(182.5);
  await page.getByRole('button', { name: 'Distribute horizontal spacing' }).click();
  savedDoc = await saved(page);
  expect(savedDoc.nodes.find((node) => node.id === 'circle-b')?.x).toBe(190);
  await page.getByRole('button', { name: 'Align horizontal centers' }).click();
  savedDoc = await saved(page);
  const [a, b, c] = ['rect-a', 'circle-b', 'rect-c'].map((id) =>
    savedDoc.nodes.find((node) => node.id === id)!,
  );
  expect(a.x + a.width / 2).toBe(b.x + b.width / 2);
  expect(b.x + b.width / 2).toBe(c.x + c.width / 2);
  await page.getByRole('button', { name: 'Distribute vertical spacing' }).click();
  savedDoc = await saved(page);
  expect(savedDoc.nodes.find((node) => node.id === 'circle-b')?.y).toBe(150);
  expect(errors).toEqual([]);
});
test('multi-selection geometry fields apply values to each selected layer', async ({ page }) => {
  const errors = await open(page);
  await select(page, 'rect-a');
  await page.locator('[data-layer-id="circle-b"] .layer-select').click({ modifiers: ['Shift'] });
  await expect(page.getByLabel('X', { exact: true })).toHaveAttribute('placeholder', 'Mixed');
  await expect(page.getByLabel('W', { exact: true })).toHaveAttribute('placeholder', 'Mixed');
  await page.getByLabel('X', { exact: true }).fill('100');
  await page.getByLabel('X', { exact: true }).press('Tab');
  await page.getByLabel('W', { exact: true }).fill('120');
  await page.getByLabel('W', { exact: true }).press('Tab');
  const doc = await saved(page),
    rectangle = doc.nodes.find((node) => node.id === 'rect-a')!,
    ellipse = doc.nodes.find((node) => node.id === 'circle-b')!;
  expect(rectangle.x).toBe(100);
  expect(ellipse.x).toBe(100);
  expect(rectangle.width).toBe(120);
  expect(ellipse.width).toBe(120);
  expect(errors).toEqual([]);
});
test('numeric labels scrub dimensions and corner radius controls edit individual corners', async ({
  page,
}) => {
  const errors = await open(page);
  await select(page, 'rect-a');
  await expect(page.locator('[data-corner-radius="topLeft"]')).toHaveAttribute(
    'cursor',
    /data:image\/svg\+xml/,
  );
  await expect(page.locator('[data-corner-radius="topLeft"] title')).toHaveText(
    'Drag to round corners. Double-click for one corner.',
  );
  await expect(page.getByRole('button', { name: 'Top-left radius' })).toHaveAttribute(
    'title',
    'Top-left radius',
  );
  const caption = page
      .locator('.field')
      .filter({ has: page.getByLabel('W', { exact: true }) })
      .locator('span'),
    box = await caption.boundingBox();
  if (!box) throw new Error('Width label is not visible.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2);
  await page.mouse.up();
  await expect(page.getByLabel('W', { exact: true })).toHaveValue('85');
  await page.getByRole('spinbutton', { name: 'Top-left radius' }).fill('24');
  await page.getByRole('spinbutton', { name: 'Top-left radius' }).press('Tab');
  const doc = await saved(page),
    shape = doc.nodes.find((n) => n.id === 'rect-a')!;
  expect(shape.width).toBe(85);
  expect(shape.cornerRadii?.topLeft).toBe(24);
  expect(shape.cornerRadii?.topRight).toBe(0);
  expect(errors).toEqual([]);
});
test('numeric geometry fields display two truncated decimals without changing document precision', async ({
  page,
}) => {
  const doc = seed(),
    rectangle = doc.nodes.find((node) => node.id === 'rect-a')!;
  rectangle.x = 265.1777777777777;
  await open(page, doc);
  await select(page, 'rect-a');
  await expect(page.getByLabel('X', { exact: true })).toHaveValue('265.17');
  expect((await saved(page)).nodes.find((node) => node.id === 'rect-a')?.x).toBe(265.1777777777777);
});
test('canvas corner handles drag uniformly or select and edit one corner', async ({ page }) => {
  const errors = await open(page);
  await select(page, 'rect-a');
  const handle = (corner: string) => page.locator(`[data-corner-radius="${corner}"]`),
    topLeft = handle('topLeft'),
    position = await topLeft.boundingBox();
  if (!position) throw new Error('Corner radius handle is not visible.');
  const startX = Number(await topLeft.getAttribute('cx')),
    startY = Number(await topLeft.getAttribute('cy'));
  await expect(topLeft).toHaveCSS('fill', 'rgb(16, 161, 207)');
  await page.mouse.move(position.x + position.width / 2, position.y + position.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    position.x + position.width / 2 + 12,
    position.y + position.height / 2 + 12,
  );
  await page.mouse.up();
  let shape = (await saved(page)).nodes.find((n) => n.id === 'rect-a')!;
  expect(shape.radius).toBeCloseTo(16.97);
  expect(shape.cornerRadii).toBeUndefined();
  const endX = Number(await topLeft.getAttribute('cx')),
    endY = Number(await topLeft.getAttribute('cy'));
  expect(endX - startX).toBeCloseTo(12);
  expect(endY - startY).toBeCloseTo(12);

  const updatedHandle = handle('topRight'),
    updatedPosition = await updatedHandle.boundingBox();
  if (!updatedPosition) throw new Error('Corner radius handle disappeared.');
  await page.mouse.click(
    updatedPosition.x + updatedPosition.width / 2,
    updatedPosition.y + updatedPosition.height / 2,
    { clickCount: 2 },
  );
  await expect(updatedHandle).toHaveAttribute('data-selected', 'true');
  await expect(updatedHandle).toHaveAttribute('fill', 'var(--radius-handle)');
  await page.mouse.move(
    updatedPosition.x + updatedPosition.width / 2,
    updatedPosition.y + updatedPosition.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    updatedPosition.x + updatedPosition.width / 2 - 2,
    updatedPosition.y + updatedPosition.height / 2 + 2,
  );
  await page.mouse.up();
  shape = (await saved(page)).nodes.find((n) => n.id === 'rect-a')!;
  expect(shape.cornerRadii?.topRight).toBeCloseTo(19.8);
  expect(shape.cornerRadii?.topLeft).toBeCloseTo(16.97);
  const bottomLeft = handle('bottomLeft'),
    bottomLeftPosition = await bottomLeft.boundingBox();
  if (!bottomLeftPosition) throw new Error('Bottom-left radius handle is not visible.');
  await page.mouse.click(
    bottomLeftPosition.x + bottomLeftPosition.width / 2,
    bottomLeftPosition.y + bottomLeftPosition.height / 2,
  );
  await page.mouse.move(
    bottomLeftPosition.x + bottomLeftPosition.width / 2,
    bottomLeftPosition.y + bottomLeftPosition.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bottomLeftPosition.x + bottomLeftPosition.width / 2 + 1,
    bottomLeftPosition.y + bottomLeftPosition.height / 2 - 1,
  );
  await page.mouse.up();
  shape = (await saved(page)).nodes.find((n) => n.id === 'rect-a')!;
  expect(shape.cornerRadii?.bottomLeft).toBeCloseTo(18.38);
  expect(shape.cornerRadii?.bottomRight).toBeCloseTo(16.97);
  expect(errors).toEqual([]);
});
test('fill color previews immediately and stroke controls expose width and color', async ({
  page,
}) => {
  const errors = await open(page);
  await select(page, 'rect-a');
  const fill = page.getByLabel('Fill', { exact: true });
  await fill.evaluate((input: HTMLInputElement) => {
    input.value = '#00ff00';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#scene [data-id="rect-a"]')).toHaveAttribute('fill', '#00ff00');
  await expect(fill).toBeVisible();
  await fill.evaluate((input: HTMLInputElement) =>
    input.dispatchEvent(new Event('change', { bubbles: true })),
  );
  const fillField = page.locator('.canvas-color-field'),
    strokeField = page.locator('.stroke-field');
  await expect(strokeField).toBeVisible();
  await expect(fillField).toBeVisible();
  await expect(fill).toHaveAttribute('title', 'Fill color');
  await expect(page.getByLabel('Enable stroke', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Stroke color', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Stroke width', { exact: true })).toBeVisible();
  const strokeWidthBox = await page.getByLabel('Stroke width', { exact: true }).boundingBox(),
    strokeColorBox = await page.getByLabel('Stroke color', { exact: true }).boundingBox(),
    strokeToggleBox = await page.getByLabel('Enable stroke', { exact: true }).boundingBox();
  expect(strokeWidthBox).not.toBeNull();
  expect(strokeColorBox).not.toBeNull();
  expect(strokeToggleBox).not.toBeNull();
  expect(Math.abs(strokeWidthBox!.y - strokeColorBox!.y)).toBeLessThan(5);
  expect(Math.abs(strokeWidthBox!.y - strokeToggleBox!.y)).toBeLessThan(5);
  expect(strokeColorBox!.width).toBeGreaterThan(24);
  expect(
    await fillField.evaluate(
      (element) =>
        element.compareDocumentPosition(document.querySelector('.stroke-field')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ),
  ).toBeTruthy();
  await page.getByLabel('Enable stroke', { exact: true }).check();
  await page.getByLabel('Stroke width', { exact: true }).fill('3');
  await page.getByLabel('Stroke width', { exact: true }).press('Tab');
  await page.getByLabel('Stroke color', { exact: true }).evaluate((input: HTMLInputElement) => {
    input.value = '#ff0000';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page
    .getByLabel('Stroke color', { exact: true })
    .evaluate((input: HTMLInputElement) =>
      input.dispatchEvent(new Event('change', { bubbles: true })),
    );
  const shape = (await saved(page)).nodes.find((n) => n.id === 'rect-a')!;
  expect(shape.fill).toBe('#00ff00');
  expect(shape.appearance?.stroke).toBe('#ff0000');
  expect(shape.appearance?.strokeWidth).toBe(3);
  expect(errors).toEqual([]);
});
test('corner radius controls are not shown for circles', async ({ page }) => {
  const errors = await open(page);
  await select(page, 'circle-b');
  await expect(page.getByLabel('Radius', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-corner-radius]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('frames expose no radius field or corner handles', async ({ page }) => {
  const frame = createNode('frame', { id: 'plain-frame', x: 100, y: 100, width: 300, height: 200 });
  const errors = await open(page, { ...createDocument(), nodes: [frame] });
  await select(page, frame.id);
  await expect(page.getByLabel('Radius', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: 'Top-left radius' })).toHaveCount(0);
  await expect(page.locator('[data-corner-radius]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('canvas fill and pick color tools apply fill and shift-click stroke', async ({ page }) => {
  const errors = await open(page);
  await select(page, 'rect-a');
  const fill = page.getByLabel('Fill', { exact: true });
  await fill.fill('#00ff00');
  await page.getByRole('button', { name: 'Apply fill' }).click();
  await expect(page.locator('#canvas')).toHaveCSS('cursor', /data:image\/svg\+xml/);
  await page.locator('#scene ellipse[data-id="circle-b"]').click();
  let doc = await saved(page);
  expect(doc.nodes.find((n) => n.id === 'circle-b')?.fill).toBe('#00ff00');

  await select(page, 'circle-b');
  await page.getByLabel('Fill', { exact: true }).fill('#0000ff');
  await page.getByLabel('Enable stroke', { exact: true }).check();
  await page.getByLabel('Stroke width', { exact: true }).fill('3');
  await page.getByLabel('Stroke width', { exact: true }).press('Tab');
  await page.getByLabel('Stroke color', { exact: true }).fill('#ff0000');
  await select(page, 'rect-a');
  await page.getByRole('button', { name: 'Pen options' }).click();
  const pickColor = page.locator('#pick-color');
  await expect(pickColor).toBeVisible();
  await pickColor.click();
  await expect(page.locator('#pen-menu')).toBeHidden();
  await expect(pickColor).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#scene ellipse[data-id="circle-b"]').click();
  doc = await saved(page);
  expect(doc.nodes.find((n) => n.id === 'rect-a')?.fill).toBe('#0000ff');
  await page.keyboard.press('i');
  await expect(pickColor).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#scene ellipse[data-id="circle-b"]').click({ modifiers: ['Shift'] });
  doc = await saved(page);
  const target = doc.nodes.find((n) => n.id === 'rect-a')!;
  expect(target.appearance?.stroke).toBe('#ff0000');
  expect(target.appearance?.strokeWidth).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
test('snap to grid can be enabled independently of geometry snapping', async ({ page }) => {
  const errors = await open(page);
  const gridSnap = page.getByRole('button', { name: 'Snap to grid', exact: true });
  await expect(gridSnap).toHaveAttribute('title', 'Snap to grid');
  await expect(gridSnap).toHaveAttribute('aria-pressed', 'false');
  await gridSnap.click();
  await expect(gridSnap).toHaveAttribute('aria-pressed', 'true');
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
  await page.getByLabel('Image brightness (%)', { exact: true }).fill('125');
  await page.getByLabel('Image brightness (%)', { exact: true }).press('Tab');
  await page.getByLabel('Image saturation (%)', { exact: true }).fill('0');
  await page.getByLabel('Image saturation (%)', { exact: true }).press('Tab');
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  const svg = await readFile((await (await download).path())!, 'utf8');
  expect(svg).toContain('data:image/png;base64,');
  expect(svg).toContain('<image');
  expect(svg).toContain('feColorMatrix');
  const savedDocument = await saved(page);
  expect(savedDocument.nodes.find((node) => node.image)?.image?.adjustments).toEqual({
    brightness: 125,
    contrast: 100,
    saturation: 0,
  });
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
test('custom closed shapes get a radius handle on every corner and the pointer tool swaps with pen', async ({
  page,
}) => {
  const vector = createNode('path', {
    id: 'corner-vector',
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
  const pen = page.getByRole('button', { name: 'Pen tool', exact: true }),
    pointer = page.getByRole('button', { name: 'Pointer tool', exact: true });
  await expect(pointer).toBeHidden();
  await select(page, vector.id);
  const handles = page.locator('[data-corner-radius="vertex"]');
  await expect(handles).toHaveCount(4);
  const box = (await handles.first().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 20);
  await page.mouse.up();
  const radius = (await saved(page)).nodes[0].radius;
  expect(radius).toBeGreaterThan(5);
  await page.keyboard.press('Enter');
  await expect(handles).toHaveCount(0);
  await expect(pointer).toBeVisible();
  await expect(pen).toBeHidden();
  await pointer.click();
  await expect(pointer).toBeHidden();
  await expect(pen).toBeVisible();
  await pen.click();
  await page.keyboard.down('Control');
  await expect(pointer).toBeVisible();
  await expect(pen).toBeHidden();
  await page.keyboard.up('Control');
  await expect(pen).toBeVisible();
  await expect(pointer).toBeHidden();
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
test('double-clicking a rectangle or ellipse converts it to an editable vector', async ({
  page,
}) => {
  const rect = createNode('rectangle', { id: 'dbl-rect', x: 100, y: 100, width: 160, height: 100 });
  const ell = createNode('ellipse', { id: 'dbl-ell', x: 400, y: 100, width: 140, height: 120 });
  const errors = await open(page, { ...createDocument(), nodes: [rect, ell] });
  let box = (await page.locator('[data-id="dbl-rect"]').boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2, { delay: 90 });
  await expect(page.locator('[data-vector-anchor]')).toHaveCount(4);
  expect((await saved(page)).nodes.find((n) => n.id === 'dbl-rect')?.type).toBe('path');
  await page.keyboard.press('Escape');
  box = (await page.locator('[data-id="dbl-ell"]').boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2, { delay: 90 });
  await expect(page.locator('[data-vector-anchor]')).toHaveCount(4);
  expect((await saved(page)).nodes.find((n) => n.id === 'dbl-ell')?.type).toBe('path');
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

test('shape buttons insert editable vectors and paint controls style them', async ({ page }) => {
  await open(page);
  await tools(page);
  await page.getByRole('button', { name: 'Insert star' }).click();
  await page.getByRole('button', { name: 'Insert line' }).click();
  await expect(page.locator('#layers .layer')).toHaveCount(seed().nodes.length + 2);
  expect((await saved(page)).nodes.at(-1)?.name).toBe('Line');
  await page.getByLabel('Blend mode').selectOption('multiply');
  await page.getByLabel('Stroke style').selectOption('dashed');
  await expect(page.locator('#canvas [style*="mix-blend-mode:multiply"]')).toHaveCount(1);
  await expect(page.locator('#canvas [stroke-dasharray]')).toHaveCount(1);
});

test('Up and Down while dragging a rectangle change it into a polygon with that many sides', async ({
  page,
}) => {
  await open(page, createDocument());
  const box = (await page.locator('[aria-label="Design canvas"]').boundingBox())!;
  const x = box.x + 300,
    y = box.y + 300;
  await page.keyboard.press('r');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 150, y + 150, { steps: 4 });
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowDown']) await page.keyboard.press(key);
  await page.mouse.up();
  const node = (await saved(page)).nodes.at(-1)!;
  expect(node.type).toBe('path');
  expect(node.vector?.rings[0]).toHaveLength(6);
  expect(node.width).toBe(150);
  await page.keyboard.press('r');
  await page.mouse.move(x + 200, y);
  await page.mouse.down();
  await page.mouse.move(x + 300, y + 100, { steps: 4 });
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowDown');
  await page.mouse.up();
  expect((await saved(page)).nodes.at(-1)?.type).toBe('rectangle');
});

test('the rectangle drop-up draws stars that use Up and Down for points, and lines', async ({
  page,
}) => {
  await open(page, createDocument());
  const box = (await page.locator('[aria-label="Design canvas"]').boundingBox())!;
  const x = box.x + 300,
    y = box.y + 300;
  const menu = page.locator('#shape-menu');
  await expect(menu).toBeHidden();
  await page.getByLabel('Shape options').click();
  await expect(menu.getByRole('menuitemradio')).toHaveCount(6);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await page.getByLabel('Shape options').click();
  await menu.locator('[data-shape=star]').click();
  await expect(menu).toBeHidden();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 160, y + 160, { steps: 4 });
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown']) await page.keyboard.press(key);
  await page.mouse.up();
  const star = (await saved(page)).nodes.at(-1)!;
  expect(star.name).toBe('Star');
  expect(star.vector?.rings[0]).toHaveLength(12);
  await page.getByLabel('Shape options').click();
  await menu.locator('[data-shape=line]').click();
  await page.mouse.move(x + 200, y);
  await page.mouse.down();
  await page.mouse.move(x + 320, y + 80, { steps: 4 });
  await page.keyboard.press('ArrowUp');
  await page.mouse.up();
  const line = (await saved(page)).nodes.at(-1)!;
  expect(line.name).toBe('Line');
  expect(line.vector?.closed).toBe(false);
  expect(line.vector?.rings[0]).toHaveLength(2);
});

test('opening an SVG file imports its shapes, colors and curves as a new document', async ({
  page,
}) => {
  await open(page, createDocument());
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">' +
    '<rect x="10" y="10" width="40" height="30" rx="4" fill="#ff0000"/>' +
    '<g transform="translate(50 50)"><circle cx="20" cy="20" r="10" fill="rgb(0,0,255)" stroke="#00ff00" stroke-width="3"/>' +
    '<path d="M0 0c10 0 10 10 0 10z" style="fill:#123456;opacity:.5"/></g>' +
    '<line x1="0" y1="0" x2="50" y2="50" stroke="black"/>' +
    '<text x="5" y="90" font-size="12">Hi</text></svg>';
  await page.locator('#file').setInputFiles({
    name: 'logo.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(svg),
  });
  await expect(page.locator('#toast')).toBeHidden();
  const doc = await saved(page);
  expect(doc.name).toBe('logo');
  const byName = (name: string) => doc.nodes.find((n) => n.name === name)!;
  expect(byName('Rectangle').fill).toBe('#ff0000');
  expect(byName('Rectangle').radius).toBe(4);
  const circle = byName('Ellipse');
  expect([circle.x, circle.y, circle.width]).toEqual([60, 60, 20]);
  expect(circle.fill).toBe('#0000ff');
  expect(circle.appearance?.stroke).toBe('#00ff00');
  const path = byName('Path');
  expect(path.opacity).toBe(0.5);
  expect(path.vector?.closed).toBe(true);
  expect(byName('Line').vector?.closed).toBe(false);
  expect(byName('Hi').type).toBe('text');
});

test('opening a broken or empty SVG shows an error and keeps the document', async ({ page }) => {
  await open(page, createDocument());
  const before = await page.locator('#documents .document-row').count();
  for (const body of [
    '<svg xmlns="http://www.w3.org/2000/svg"><rect',
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
  ]) {
    await page.locator('#file').setInputFiles({
      name: 'bad.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(body),
    });
    await expect(page.locator('#toast')).toContainText(/SVG/);
  }
  await expect(page.locator('#documents .document-row')).toHaveCount(before);
});

test('dropping an SVG on the canvas inserts its shapes into the current document', async ({
  page,
}) => {
  await open(page, createDocument());
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#ee2233"/></svg>';
  await page.evaluate((source) => {
    const data = new DataTransfer();
    data.items.add(new File([source], 'icon.svg', { type: 'image/svg+xml' }));
    const canvas = document.querySelector('#canvas')!;
    canvas.dispatchEvent(
      new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
    );
  }, svg);
  await expect.poll(async () => (await saved(page)).nodes.length).toBe(1);
  const node = (await saved(page)).nodes[0]!;
  expect(node.type).toBe('ellipse');
  expect(node.fill).toBe('#ee2233');
  await expect(page.locator('#toast')).toBeHidden();
});

test('the shape menu draws arrows, polygons and ellipses and has keyboard shortcuts', async ({
  page,
}) => {
  await open(page, createDocument());
  const box = (await page.locator('[aria-label="Design canvas"]').boundingBox())!;
  const x = box.x + 300,
    y = box.y + 300;
  const menu = page.locator('#shape-menu');
  const drag = async (dx: number, dy: number, keys: string[] = []) => {
    const top = y;
    await page.mouse.move(x, top);
    await page.mouse.down();
    await page.mouse.move(x + dx, top + dy, { steps: 4 });
    for (const key of keys) await page.keyboard.press(key);
    await page.mouse.up();
    const node = (await saved(page)).nodes.at(-1)!;
    await page.keyboard.press('Escape');
    return node;
  };
  await page.getByLabel('Shape options').click();
  await menu.locator('[data-shape=arrow]').click();
  await expect(menu.locator('[data-shape=arrow]')).toHaveAttribute('aria-checked', 'true');
  const arrow = await drag(160, 0);
  expect(arrow.name).toBe('Arrow');
  expect(arrow.vector?.closed).toBe(false);
  expect(arrow.vector?.rings).toHaveLength(2);
  expect(arrow.height).toBeGreaterThan(5);
  await page.getByLabel('Shape options').click();
  await menu.locator('[data-shape=polygon]').click();
  const triangle = await drag(150, 150);
  expect([triangle.name, triangle.vector?.rings[0]?.length]).toEqual(['Polygon', 3]);
  await page.getByLabel('Shape options').click();
  await menu.locator('[data-shape=polygon]').click();
  const hexagon = await drag(150, 150, ['ArrowUp', 'ArrowUp', 'ArrowUp']);
  expect(hexagon.vector?.rings[0]).toHaveLength(6);
  await page.getByLabel('Shape options').click();
  await menu.locator('[data-shape=ellipse]').click();
  await expect(menu.locator('[data-shape=ellipse]')).toHaveAttribute('aria-checked', 'true');
  expect((await drag(120, 80)).type).toBe('ellipse');
  await page.keyboard.press('l');
  expect((await drag(100, 40)).name).toBe('Line');
  await page.keyboard.press('Shift+L');
  expect((await drag(100, 40)).name).toBe('Arrow');
  await page.keyboard.press('r');
  expect((await drag(100, 40)).type).toBe('rectangle');
});

test('the pen menu switches between pen and pencil and the pencil draws freehand', async ({
  page,
}) => {
  const errors = await open(page, createDocument());
  const box = (await page.locator('[aria-label="Design canvas"]').boundingBox())!;
  const menu = page.locator('#pen-menu');
  await page.getByLabel('Pen options').click();
  await expect(menu.locator('[data-pen=pen]')).toHaveAttribute('aria-checked', 'true');
  await expect(menu.getByRole('menuitemcheckbox', { name: 'Pick color' })).toBeVisible();
  await menu.locator('[data-pen=pencil]').click();
  await expect(menu).toBeHidden();
  await expect(page.locator('#pen-tool')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pen-tool')).toHaveAttribute('title', 'Pencil (Shift+P)');
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++)
    await page.mouse.move(box.x + 300 + i * 8, box.y + 300 + Math.sin(i / 3) * 40);
  await page.mouse.up();
  const node = (await saved(page)).nodes.at(-1)!;
  expect(node.vector?.closed).toBe(false);
  expect(node.vector?.rings[0]?.length).toBeGreaterThan(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pen-tool')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Shift+P');
  await expect(page.locator('#pen-tool')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await page.keyboard.press('p');
  await expect(page.locator('#pen-tool')).toHaveAttribute('title', 'Pen (P)');
  expect(errors).toEqual([]);
});

test('the text menu places text on a path that follows the shape', async ({ page }) => {
  const errors = await open(page);
  await page.getByLabel('Text options').click();
  const menu = page.locator('#text-menu');
  await expect(menu.locator('[data-text=text]')).toHaveAttribute('aria-checked', 'true');
  await menu.locator('[data-text=path]').click();
  await expect(menu).toBeHidden();
  await expect(page.locator('[data-tool=text]')).toHaveAttribute('title', 'Text on path');
  await page.locator('#scene ellipse[data-id="circle-b"]').click();
  const doc = await saved(page);
  const node = doc.nodes.at(-1)!;
  expect(node.type).toBe('text');
  expect(node.textPath?.closed).toBe(true);
  expect(node.textPath?.rings[0]).toHaveLength(4);
  await expect(page.locator('#scene textPath')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.keyboard.press('t');
  await expect(page.locator('[data-tool=text]')).toHaveAttribute('title', 'Text (T)');
  expect(errors).toEqual([]);
});

test('the Image item and Ctrl+Shift+K open the image picker', async ({ page }) => {
  await open(page, createDocument());
  await page.getByLabel('Shape options').click();
  const first = page.waitForEvent('filechooser');
  await page.locator('#shape-menu [data-action=image]').click();
  await first;
  await expect(page.locator('#shape-menu')).toBeHidden();
  const second = page.waitForEvent('filechooser');
  await page.keyboard.press('Control+Shift+K');
  await second;
});
