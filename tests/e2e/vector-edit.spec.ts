import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { createDocument, createNode } from '../../src/model/document.ts';
import type { DesignDocument } from '../../src/model/types.ts';
const seed = () => ({
  ...createDocument(),
  nodes: [
    createNode('path', {
      id: 'curve',
      x: 100,
      y: 100,
      width: 300,
      height: 150,
      vector: {
        closed: false,
        rings: [
          [
            { x: 0, y: 0, out: { x: 0.2, y: 1 } },
            { x: 1, y: 0, in: { x: 0.8, y: 1 } },
          ],
        ],
      },
    }),
  ],
});
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('redesign.document')!) as DesignDocument);
test.beforeEach(async ({ page }) => {
  await page.addInitScript((doc) => {
    localStorage.clear();
    localStorage.setItem('redesign.document', JSON.stringify(doc));
  }, seed());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-app-state', 'ready');
  await page.locator('[data-layer-id="curve"] .layer-select').click();
});
test('inspector inserts and deletes cubic anchors with undo and disabled endpoint actions', async ({
  page,
}) => {
  const before = await saved(page);
  await page.getByRole('button', { name: 'Path 1 point 1: Insert after', exact: true }).click();
  expect((await saved(page)).nodes[0].vector!.rings[0]).toHaveLength(3);
  await page.getByRole('button', { name: 'Path 1 point 2: Delete', exact: true }).click();
  expect((await saved(page)).nodes[0].vector!.rings[0]).toHaveLength(2);
  await expect(
    page.getByRole('button', { name: 'Path 1 point 2: Insert after', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Path 1 point 1: Delete', exact: true }),
  ).toBeDisabled();
  await page.locator('#canvas').focus();
  await page.keyboard.press('Control+z');
  expect((await saved(page)).nodes[0].vector!.rings[0]).toHaveLength(3);
  await page.keyboard.press('Control+z');
  expect((await saved(page)).nodes).toEqual(before.nodes);
});
test('double-clicking a curve segment inserts an anchor and Delete removes the selected point only', async ({
  page,
}) => {
  await page.keyboard.press('Enter');
  const segment = page.locator('[data-vector-segment]').first();
  await expect(segment).toBeVisible();
  // The middle of this symmetric cubic is x=.5,y=.75 in its unrotated bounds.
  const canvas = (await page.locator('#canvas').boundingBox())!;
  await page.mouse.dblclick(canvas.x + 80 + 250, canvas.y + 80 + 212.5);
  await expect(page.locator('[data-vector-anchor]')).toHaveCount(3);
  await page.keyboard.press('Delete');
  await expect(page.locator('[data-vector-anchor]')).toHaveCount(2);
  expect((await saved(page)).nodes).toHaveLength(1);
  await page.keyboard.press('Control+z');
  expect((await saved(page)).nodes[0].vector!.rings[0]).toHaveLength(3);
});
