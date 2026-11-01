import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { createDocument, createNode } from '../../src/model/document.ts';
import { defaultAppearance } from '../../src/model/features.ts';
import type { DesignDocument } from '../../src/model/types.ts';
import { readFile } from 'node:fs/promises';
const saved = (p: Page) =>
  p.evaluate(() => JSON.parse(localStorage.getItem('redesign.document')!) as DesignDocument);
test.beforeEach(async ({ page }) => {
  const doc = {
    ...createDocument(),
    nodes: [
      createNode('ellipse', {
        id: 'mask',
        name: 'Mask shape',
        x: 100,
        y: 100,
        width: 100,
        height: 100,
      }),
      createNode('rectangle', {
        id: 'art',
        name: 'Artwork',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        fill: '#ff0000',
        appearance: { ...defaultAppearance(), stroke: '#0000ff', strokeWidth: 4 },
      }),
    ],
  };
  await page.addInitScript((doc) => {
    if (!localStorage.getItem('redesign.document')) {
      localStorage.setItem('redesign.document', JSON.stringify(doc));
    }
  }, doc);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-app-state', 'ready');
});
test('outline mask clips canvas selection and SVG export, persists and can be released', async ({
  page,
}) => {
  await page.locator('[data-layer-id="mask"] .layer-select').click();
  await page.locator('[data-layer-id="art"] .layer-select').click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'Use bottom layer as outline mask', exact: true }).click();
  await expect(page.locator('#scene clipPath ellipse')).toHaveCount(1);
  expect((await saved(page)).nodes.find((n) => n.type === 'group')!.maskId).toBe('mask');
  const canvas = (await page.locator('#canvas').boundingBox())!;
  await page.mouse.click(canvas.x + 80 + 110, canvas.y + 80 + 102);
  await expect(page.locator('#layers .layer.active')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  expect(await readFile((await (await download).path())!, 'utf8')).toContain('<clipPath');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-app-state', 'ready');
  await page.getByRole('button', { name: 'Outline mask', exact: true }).click();
  await page.getByRole('button', { name: 'Release outline mask', exact: true }).click();
  await expect(page.locator('#scene clipPath')).toHaveCount(0);
});
test('outline stroke produces an editable filled path while retaining the source fill and undo', async ({
  page,
}) => {
  await page.locator('[data-layer-id="art"] .layer-select').click();
  const before = await saved(page);
  await page.getByRole('button', { name: 'Outline stroke', exact: true }).click();
  const doc = await saved(page),
    outline = doc.nodes.find((n) => n.name === 'Outlined stroke')!;
  expect(outline.type).toBe('path');
  expect(outline.fill).toBe('#0000ff');
  expect(outline.appearance?.strokeWidth).toBe(0);
  expect(doc.nodes.find((n) => n.id === 'art')!.fill).toBe('#ff0000');
  await page.locator('#canvas').focus();
  await page.keyboard.press('Control+z');
  expect((await saved(page)).nodes).toEqual(before.nodes);
});
