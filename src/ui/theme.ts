type ThemePreference = 'light' | 'dark' | 'system';
interface ThemeControls {
  select: Pick<HTMLSelectElement, 'value' | 'addEventListener'>;
  root: Pick<HTMLElement, 'dataset'>;
  system: Pick<MediaQueryList, 'matches' | 'addEventListener'>;
  storage: () => Pick<Storage, 'getItem' | 'setItem'>;
}
/** Keep the saved preference separate from the resolved light/dark appearance. */
export function bindThemeSelector(controls?: ThemeControls): void {
  const select = controls?.select ?? document.querySelector<HTMLSelectElement>('#theme-select');
  if (!select) throw new Error('Missing theme selector');
  const root = controls?.root ?? document.documentElement;
  const system = controls?.system ?? matchMedia('(prefers-color-scheme: dark)');
  const storage = controls?.storage ?? (() => localStorage);
  let preference: ThemePreference = 'system';
  try {
    const saved = storage().getItem('redesign.theme');
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch {
    /* Use the system preference when storage is unavailable. */
  }
  const apply = () => {
    select.value = preference;
    root.dataset.theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
  };
  apply();
  select.addEventListener('change', () => {
    const value = select.value;
    if (value !== 'light' && value !== 'dark' && value !== 'system') return;
    preference = value;
    apply();
    try {
      storage().setItem('redesign.theme', preference);
    } catch {
      /* Keep the selection active for this session. */
    }
  });
  system.addEventListener('change', () => {
    if (preference === 'system') apply();
  });
}
