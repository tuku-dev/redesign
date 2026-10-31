import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument } from '../../src/model/document.ts';
async function start(
  page: Page,
  mode: 'download' | 'file' | 'cancel' | 'fail' | 'open' = 'download',
) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(
    ({ doc, mode }) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.clear();
        localStorage.setItem('redesign.document', JSON.stringify(doc));
        sessionStorage.setItem('seeded', 'true');
      }
      const state = {
        calls: 0,
        writes: 0,
        openCalls: 0,
        payload: '',
        closed: false,
        aborted: false,
        suggested: '',
      };
      Object.defineProperty(window, '__fileSaveTest', { configurable: true, value: state });
      Object.defineProperty(window, 'showOpenFilePicker', {
        configurable: true,
        value:
          mode === 'open'
            ? async () => {
                state.openCalls++;
                return [
                  {
                    name: 'Opened dashboard.redesign',
                    getFile: async () =>
                      new File([JSON.stringify(doc)], 'Opened dashboard.redesign', {
                        type: 'application/json',
                      }),
                    createWritable: async () => ({
                      write: async (data: string) => {
                        state.writes++;
                        state.payload = data;
                      },
                      close: async () => {
                        state.closed = true;
                      },
                    }),
                  },
                ];
              }
            : undefined,
      });
      Object.defineProperty(window, 'showSaveFilePicker', {
        configurable: true,
        value:
          mode === 'download'
            ? undefined
            : async (options: { suggestedName: string }) => {
                state.calls++;
                state.suggested = options.suggestedName;
                if (mode === 'cancel') throw new DOMException('Canceled', 'AbortError');
                return {
                  name: 'Chosen dashboard.redesign',
                  createWritable: async () => ({
                    write: async (data: string) => {
                      if (mode === 'fail') throw new Error('Disk full');
                      state.writes++;
                      state.payload = data;
                    },
                    close: async () => {
                      state.closed = true;
                    },
                    abort: async () => {
                      state.aborted = true;
                    },
                  }),
                };
              },
      });
    },
    { doc: createDocument(), mode },
  );
  await page.goto('/');
  await expect(page.getByLabel('Document name', { exact: true })).toHaveValue('Untitled');
  return errors;
}
const state = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __fileSaveTest: {
            calls: number;
            writes: number;
            openCalls: number;
            payload: string;
            closed: boolean;
            aborted: boolean;
            suggested: string;
          };
        }
      ).__fileSaveTest,
  );
test('download save updates the header, file data and autosaved title, including after reload', async ({
  page,
}) => {
  const errors = await start(page);

  const download = page.waitForEvent('download');
  await page.locator('#save-as').click();
  const dialog = page.getByRole('dialog', { name: 'Download a copy' });
  await dialog.getByRole('textbox', { name: 'File name' }).fill('Dashboard.redesign');
  await dialog.getByRole('button', { name: 'Download copy', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('Dashboard.redesign');
  const data = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(data.name).toBe('Dashboard');
  await expect(page.getByLabel('Document name', { exact: true })).toHaveValue('Dashboard');
  await expect(page).toHaveTitle('Dashboard - reDesign');
  await page.reload();
  await expect(page.getByLabel('Document name', { exact: true })).toHaveValue('Dashboard');
  expect(errors).toEqual([]);
});
test('canceling the app download dialog leaves the header and document untouched', async ({
  page,
}) => {
  const errors = await start(page);

  await page.locator('#save-as').click();
  await page
    .getByRole('dialog', { name: 'Download a copy' })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect(page.locator('#save')).toBeEnabled();
  await expect(page.getByLabel('Document name', { exact: true })).toHaveValue('Untitled');
  await expect(page.locator('#undo')).toBeDisabled();
  expect(errors).toEqual([]);
});
test('opening an externally renamed file uses its filename instead of stale embedded metadata', async ({
  page,
}) => {
  const errors = await start(page),
    doc = { ...createDocument(), name: 'Old embedded name' };
  await page.locator('#file').setInputFiles({
    name: 'Actual filename.redesign',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  await expect(page.getByLabel('Document name', { exact: true })).toHaveValue('Actual filename');
  await expect(page).toHaveTitle('Actual filename - reDesign');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('redesign.document')!));
  expect(saved.name).toBe('Actual filename');
  expect(errors).toEqual([]);
});
test('native picker result updates the header after write and subsequent saves reuse the handle', async ({
  page,
}) => {
  const errors = await start(page, 'file');
  await page.locator('#save').click();
  await expect(page.getByLabel('Document name', { exact: true })).toHaveValue('Chosen dashboard');
  let result = await state(page);
  expect(result.suggested).toBe('Untitled.redesign');
  expect(result.closed).toBe(true);
  expect(JSON.parse(result.payload).name).toBe('Chosen dashboard');
  await page.locator('#save').click();
  await expect(page.locator('#save')).toBeEnabled();
  result = await state(page);
  expect(result.calls).toBe(1);
  expect(errors).toEqual([]);
});
test('canceling the native picker preserves the displayed title', async ({ page }) => {
  const errors = await start(page, 'cancel');
  await page.locator('#save').click();
  await expect(page.locator('#save')).toBeEnabled();
  await expect(page.getByLabel('Document name', { exact: true })).toHaveValue('Untitled');
  expect((await state(page)).closed).toBe(false);
  expect(errors).toEqual([]);
});
test('New warns before replacing the browser-saved draft and clears its history when confirmed', async ({
  page,
}) => {
  const errors = await start(page);
  await page.locator('#add').click();
  await expect(page.locator('#layers .layer')).toHaveCount(1);

  const canceledDialog = page.waitForEvent('dialog').then(async (dialog) => {
    expect(dialog.message()).toContain('Save a copy first');
    await dialog.dismiss();
  });
  await page.locator('#new-document').click();
  await canceledDialog;
  await expect(page.locator('#layers .layer')).toHaveCount(1);

  const acceptedDialog = page.waitForEvent('dialog').then((dialog) => dialog.accept());
  await page.locator('#new-document').click();
  await acceptedDialog;
  await expect(page.locator('#layers .layer')).toHaveCount(0);
  await expect(page.locator('#undo')).toBeDisabled();
  await expect(page.getByLabel('Document name', { exact: true })).toHaveValue('Untitled');
  expect(errors).toEqual([]);
});
test('opening a file warns before replacing the browser-saved draft', async ({ page }) => {
  const errors = await start(page);
  await page.locator('#add').click();
  await expect(page.locator('#layers .layer')).toHaveCount(1);
  const upload = {
    name: 'Opened dashboard.redesign',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(createDocument())),
  };

  const canceledDialog = page.waitForEvent('dialog');
  await page.locator('#file').setInputFiles(upload);
  await (await canceledDialog).dismiss();
  await expect(page.locator('#layers .layer')).toHaveCount(1);

  const acceptedDialog = page.waitForEvent('dialog');
  await page.locator('#file').setInputFiles(upload);
  await (await acceptedDialog).accept();
  await expect(page.locator('#layers .layer')).toHaveCount(0);
  await expect(page.getByLabel('Document name', { exact: true })).toHaveValue('Opened dashboard');
  expect(errors).toEqual([]);
});
test('failed native writes report the error and keep the original title', async ({ page }) => {
  const errors = await start(page, 'fail');
  await page.locator('#save').click();
  await expect(page.locator('#toast')).toHaveText('Disk full');
  await expect(page.getByLabel('Document name', { exact: true })).toHaveValue('Untitled');
  expect((await state(page)).aborted).toBe(true);
  expect(errors).toEqual([]);
});
test('Ctrl+S saves in browser without dialogs or downloads even while editing fields', async ({
  page,
}) => {
  const errors = await start(page),
    dialogs: string[] = [];
  let downloads = 0;
  page.on('download', () => downloads++);
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.type());
    await dialog.dismiss();
  });
  const name = page.getByLabel('Document name', { exact: true });
  await name.fill('Browser project');
  await name.press('Control+s');
  await expect(page.locator('#save')).toBeEnabled();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await page.locator('#add').click();
  const layerName = page.getByLabel('Name', { exact: true });
  await layerName.fill('Updated card');
  await layerName.press('Control+s');
  await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#canvas').focus();
  await page.keyboard.press('Control+s');
  await expect(page.locator('#save')).toBeEnabled();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('redesign.document')!));
  expect(saved.name).toBe('Browser project');
  expect(saved.nodes[0].name).toBe('Updated card');
  expect(dialogs).toEqual([]);
  expect(downloads).toBe(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('Ctrl+S reuses the file after saving, field edits and project title changes; Save As is explicit', async ({
  page,
}) => {
  const errors = await start(page, 'file');
  await page.locator('#save').click();
  await expect(page.locator('#save')).toBeEnabled();
  const name = page.getByLabel('Document name', { exact: true });
  await name.fill('Changed title');
  await name.press('Control+s');
  await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#canvas').focus();
  await page.keyboard.press('Control+s');
  await expect(page.locator('#save')).toBeEnabled();
  let result = await state(page);
  expect(result.calls).toBe(1);
  expect(result.writes).toBe(3);
  expect(JSON.parse(result.payload).name).toBe('Chosen dashboard');
  await page.keyboard.press('Control+Shift+s');
  await expect(page.locator('#save')).toBeEnabled();
  result = await state(page);
  expect(result.calls).toBe(2);
  expect(errors).toEqual([]);
});
test('opening a native file retains its handle for Ctrl+S without a new save picker', async ({
  page,
}) => {
  const errors = await start(page, 'open');
  await page.locator('#open').click();
  await expect(page.getByLabel('Document name', { exact: true })).toHaveValue('Opened dashboard');
  await page.locator('#canvas').focus();
  await page.keyboard.press('Control+s');
  await expect(page.locator('#save')).toBeEnabled();
  const result = await state(page);
  expect(result.openCalls).toBe(1);
  expect(result.calls).toBe(0);
  expect(result.writes).toBe(1);
  expect(JSON.parse(result.payload).name).toBe('Opened dashboard');
  expect(errors).toEqual([]);
});
test('Ctrl+Shift+S opens the app download dialog without using a browser prompt', async ({
  page,
}) => {
  const errors = await start(page),
    dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.type());
    await dialog.dismiss();
  });
  await page.getByLabel('Document name', { exact: true }).focus();
  await page.keyboard.press('Control+Shift+s');
  await expect(page.getByRole('dialog', { name: 'Download a copy' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(dialogs).toEqual([]);
  expect(errors).toEqual([]);
});
