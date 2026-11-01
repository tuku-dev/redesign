import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createDocument, createNode } from '../../src/model/document.ts';
import type { DesignDocument } from '../../src/model/types.ts';
import { makeFig, basicFigNodes, id, parent, solid } from '../fixtures/fig-builder.ts';
import { readFile } from 'node:fs/promises';

const review = (page: Page) =>
  page.getByRole('dialog', { name: 'Review experimental Figma import' });
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('redesign.document')!) as DesignDocument);
async function start(page: Page, seeded = true, nativeBytes?: number[]) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const doc = createDocument();
  doc.name = seeded ? 'Existing work' : 'Untitled';
  if (seeded) doc.nodes = [createNode('rectangle', { id: 'original', name: 'Keep me' })];
  await page.addInitScript(
    ({ doc, nativeBytes }) => {
      const state = { sourceWrites: 0, savePickers: 0, payload: '', suggested: '' };
      Object.defineProperty(window, '__figHandleTest', { configurable: true, value: state });
      Object.defineProperty(window, 'showOpenFilePicker', {
        configurable: true,
        value: nativeBytes
          ? async () => [
              {
                name: 'Source.fig',
                getFile: async () => new File([new Uint8Array(nativeBytes)], 'Source.fig'),
                createWritable: async () => {
                  state.sourceWrites++;
                  return { write: async () => {}, close: async () => {} };
                },
              },
            ]
          : undefined,
      });
      Object.defineProperty(window, 'showSaveFilePicker', {
        configurable: true,
        value: nativeBytes
          ? async (options: { suggestedName: string }) => {
              state.savePickers++;
              state.suggested = options.suggestedName;
              return {
                name: options.suggestedName,
                createWritable: async () => ({
                  write: async (data: string) => {
                    state.payload = data;
                  },
                  close: async () => {},
                }),
              };
            }
          : undefined,
      });
      if (!sessionStorage.getItem('seeded')) {
        localStorage.clear();
        localStorage.setItem('redesign.document', JSON.stringify(doc));
        sessionStorage.setItem('seeded', 'true');
      }
    },
    { doc, nativeBytes },
  );
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-app-state', 'ready');
  return errors;
}
async function upload(page: Page, bytes = makeFig(), name = 'Editable.fig') {
  await page
    .locator('#file')
    .setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
  await expect(review(page)).toBeVisible();
}

test('native fixture is parsed in a worker and cancel or Escape preserves the current document', async ({
  page,
}) => {
  const errors = await start(page);
  const before = await saved(page);
  await page.locator('#file').setInputFiles('tests/fixtures/fig/corners.fig');
  await expect(review(page)).toContainText('10 editable layer(s), 0 skipped layer(s)');
  await expect(review(page)).toContainText('network topology');
  await expect(review(page)).toContainText('smoothing');
  await page.screenshot({ path: 'test-results/fig-import-review.png' });
  expect(await saved(page)).toEqual(before);
  await review(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(review(page)).toHaveCount(0);
  expect(await saved(page)).toEqual(before);
  await expect(page.locator('#open')).toBeEnabled();
  await upload(page);
  await page.keyboard.press('Escape');
  await expect(review(page)).toHaveCount(0);
  expect(await saved(page)).toEqual(before);
  expect(errors).toEqual([]);
});
test('supported layers import into a separate document, remain editable and survive reload', async ({
  page,
}) => {
  const errors = await start(page);
  await upload(page);
  await review(page).getByRole('button', { name: 'Import supported layers' }).click();
  await expect(page.locator('#layers .layer')).toHaveCount(4);
  await expect(page.locator('#documents .document-row')).toHaveCount(2);
  const doc = await saved(page);
  expect(doc.name).toBe('Editable');
  expect(doc.nodes[1].parentId).toBe('fig:1:2');
  expect(doc.nodes[3].text).toBe('Hello \u4e16\u754c');
  await page.locator('[data-layer-id="fig:1:3"] .layer-select').click();
  await page.keyboard.press('ArrowRight');
  expect((await saved(page)).nodes[1].x).toBe(doc.nodes[1].x + 1);
  await page.keyboard.press('Control+z');
  expect((await saved(page)).nodes).toEqual(doc.nodes);
  await page.reload();
  expect((await saved(page)).nodes).toEqual(doc.nodes);
  expect(errors).toEqual([]);
});
test('real Zstandard fixture opens its disclosed subset and supports an SVG export', async ({
  page,
}) => {
  await start(page, false);
  await page.locator('#file').setInputFiles('tests/fixtures/fig/corners.fig');
  await expect(review(page)).toBeVisible();
  await review(page).getByRole('button', { name: 'Import supported layers' }).click();
  await expect(page.locator('#layers .layer')).toHaveCount(10);
  expect((await saved(page)).name).toBe('corners');
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('corners.svg');
  expect(await readFile((await file.path())!, 'utf8')).toContain('A 12 12');
});
test('bare fig-kiwi bytes are detected without a .fig extension', async ({ page }) => {
  await start(page, false);
  await upload(page, makeFig(undefined, false), 'Binary.bin');
  await review(page).getByRole('button', { name: 'Import supported layers' }).click();
  await expect(page.locator('#layers .layer')).toHaveCount(4);
});
test('invalid files keep drafts intact and release the import lock for a subsequent valid file', async ({
  page,
}) => {
  const errors = await start(page);
  const before = await saved(page);
  for (const buffer of [Buffer.from('fig-kiwi'), Buffer.from('{}')]) {
    await page
      .locator('#file')
      .setInputFiles({ name: 'broken.fig', mimeType: 'application/octet-stream', buffer });
    await expect(page.locator('#toast')).toContainText('Cannot import .fig');
    expect(await saved(page)).toEqual(before);
    await expect(page.locator('#open')).toBeEnabled();
  }
  await upload(page);
  await review(page).getByRole('button', { name: 'Import supported layers' }).click();
  await expect(page.locator('#layers .layer')).toHaveCount(4);
  expect(errors).toEqual([]);
});
test('unsupported component subtrees are reported before accepting the remaining editable shapes', async ({
  page,
}) => {
  await start(page, false);
  const nodes: Record<string, unknown>[] = basicFigNodes();
  nodes[2].type = 'SYMBOL';
  nodes.push({
    guid: id(10),
    type: 'ELLIPSE',
    parentIndex: parent(1),
    size: { x: 40, y: 40 },
    fillPaints: [solid()],
  });
  await upload(page, makeFig(nodes));
  await expect(review(page)).toContainText('1 editable layer(s), 4 skipped layer(s)');
  await expect(review(page)).toContainText('SYMBOL');
  await review(page).getByRole('button', { name: 'Import supported layers' }).click();
  await expect(page.locator('#layers .layer')).toHaveCount(1);
});

test('native Open never connects the original .fig handle to the document saver', async ({
  page,
}) => {
  await start(page, false, [...makeFig()]);
  await page.locator('#open').click();
  await expect(review(page)).toBeVisible();
  await review(page).getByRole('button', { name: 'Import supported layers' }).click();
  await expect(page.locator('#layers .layer')).toHaveCount(4);
  await page.keyboard.press('Control+s');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __figHandleTest: { payload: string } }).__figHandleTest.payload,
      ),
    )
    .not.toBe('');
  const state = await page.evaluate(
    () =>
      (
        window as unknown as {
          __figHandleTest: {
            sourceWrites: number;
            savePickers: number;
            suggested: string;
            payload: string;
          };
        }
      ).__figHandleTest,
  );
  expect(state.sourceWrites).toBe(0);
  expect(state.savePickers).toBe(1);
  expect(state.suggested).toBe('Source.redesign');
  expect(JSON.parse(state.payload).format).toBe('redesign');
});
test('a stalled parser worker is terminated and leaves the current document available', async ({
  page,
}) => {
  await start(page);
  const before = await saved(page);
  await page.clock.install();
  await page.evaluate(() => {
    const state = { terminated: 0 };
    Object.defineProperty(window, '__figWorkerTest', { value: state });
    Object.defineProperty(window, 'Worker', {
      configurable: true,
      value: class {
        postMessage() {}
        terminate() {
          state.terminated++;
        }
      },
    });
  });
  await page.locator('#file').setInputFiles({
    name: 'stalled.fig',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('fig-kiwi'),
  });
  await expect(page.locator('#open')).toBeDisabled();
  await page.clock.fastForward(15001);
  await expect(page.locator('#toast')).toContainText('parsing exceeded 15 seconds');
  await expect(page.locator('#open')).toBeEnabled();
  expect(await saved(page)).toEqual(before);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __figWorkerTest: { terminated: number } }).__figWorkerTest
          .terminated,
    ),
  ).toBe(1);
});

test('native embedded images render and remain embedded in SVG exports', async ({ page }) => {
  await start(page, false);
  await page.locator('#file').setInputFiles('tests/fixtures/fig/structure.fig');
  await expect(review(page)).toContainText('18 editable layer(s), 5 skipped layer(s)');
  await review(page).getByRole('button', { name: 'Import supported layers' }).click();
  await expect(page.locator('#scene image')).toHaveCount(2);
  const document = await saved(page);
  expect(document.nodes.filter((n) => n.image)).toHaveLength(2);
  await page.locator('[data-layer-id="fig:1:24"] .layer-select').click();
  await expect(page.getByLabel('Image fit', { exact: true })).toHaveValue('cover');
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  const output = await readFile((await (await download).path())!, 'utf8');
  expect(output).toContain('data:image/png;base64,');
  expect(output).toContain('data:image/jpeg;base64,');
  expect(output).toContain('fill-rule="nonzero"');
});
test('imported cubic vectors expose editable anchors and undo restores their original controls', async ({
  page,
}) => {
  await start(page, false);
  await page.locator('#file').setInputFiles('tests/fixtures/fig/corners.fig');
  await review(page).getByRole('button', { name: 'Import supported layers' }).click();
  await page.locator('[data-layer-id="fig:2051:4"] .layer-select').click();
  await page.keyboard.press('Enter');
  const anchor = page.locator('[data-vector-editor] [data-vector-anchor]').first();
  await expect(anchor).toBeVisible();
  const before = await saved(page),
    box = (await anchor.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10, { steps: 5 });
  await page.mouse.up();
  expect((await saved(page)).nodes).not.toEqual(before.nodes);
  await page.keyboard.press('Control+z');
  expect((await saved(page)).nodes).toEqual(before.nodes);
});
