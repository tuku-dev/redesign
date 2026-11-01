import { test, expect } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  test(`inline loader hides raw HTML while styles load in ${theme} mode`, async ({ page }) => {
    await page.addInitScript((theme) => localStorage.setItem('redesign.theme', theme), theme);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let release!: () => void, requested!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      requested = resolve;
    });
    await page.route('**/src/editor/style.css*', async (route) => {
      requested();
      await gate;
      await route.continue();
    });
    try {
      await page.goto('/', { waitUntil: 'commit' });
      await started;
      await expect(page.getByRole('status', { name: 'Loading reDesign' })).toBeVisible();
      await expect(page.locator('header')).toBeHidden();
      await expect(page.locator('main')).toBeHidden();
      await expect(page.locator('#app-loader')).toHaveCSS(
        'background-color',
        theme === 'dark' ? 'rgb(44, 44, 44)' : 'rgb(255, 255, 255)',
      );
      await expect(page.locator('.loading-spinner')).toHaveCSS('animation-name', 'none');
      await page.screenshot({ path: `test-results/loading-${theme}.png` });
    } finally {
      release();
    }
    await expect(page.locator('html')).toHaveAttribute('data-app-state', 'ready');
    await expect(page.locator('#app-loader')).toHaveCount(0);
    await expect(page.locator('body')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('#canvas')).toBeVisible();
    await expect(page.locator('#theme-select')).toHaveValue(theme);
  });
}

for (const module of ['main', 'bootstrap']) {
  test(`failed ${module} download offers recovery instead of raw HTML`, async ({ page }) => {
    await page.route(`**/src/${module}.ts*`, (route) => route.abort('failed'));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-app-state', 'failed');
    await expect(page.locator('#loading-message')).toContainText('could not load');
    await expect(page.getByRole('button', { name: 'Reload', exact: true })).toBeVisible();
    await expect(page.locator('header')).toBeHidden();
    await expect(page.locator('.loading-spinner')).toBeHidden();
  });
}

test('disabled JavaScript explains the requirement while keeping the skeleton hidden', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5173/');
    await expect(page.locator('noscript div')).toBeVisible();
    await expect(page.locator('noscript div')).toHaveText('Enable JavaScript to use reDesign.');
    await expect(page.locator('header')).toBeHidden();
    await expect(page.locator('.loading-spinner')).toBeHidden();
  } finally {
    await context.close();
  }
});
