/** Keep the inline loading screen until CSS, document restoration and first render are ready. */
async function start(): Promise<void> {
  try {
    await import('./main.ts');
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    document.documentElement.dataset.appState = 'ready';
    document.body.setAttribute('aria-busy', 'false');
    document.getElementById('app-loader')?.remove();
  } catch (error) {
    console.error('reDesign startup failed:', error);
    document.documentElement.dataset.appState = 'failed';
    document.body.setAttribute('aria-busy', 'false');
    const message = document.getElementById('loading-message');
    if (message) message.textContent = 'reDesign could not load. Reload to try again.';
    const reload = document.getElementById('loading-retry');
    if (reload) reload.hidden = false;
  }
}
void start();
