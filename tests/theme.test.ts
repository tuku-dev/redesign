import test from 'node:test';
import assert from 'node:assert/strict';
import { bindThemeSelector } from '../src/ui/theme.ts';
class ThemeSelect extends EventTarget {
  value = '';
}
class SystemTheme extends EventTarget {
  matches = false;
}
function setup(saved: string | null = null, blocked = false) {
  const select = new ThemeSelect();
  const system = new SystemTheme();
  const root = { dataset: {} as DOMStringMap };
  let stored = saved;
  const storage = () => {
    if (blocked) throw new Error('Storage blocked');
    return {
      getItem: () => stored,
      setItem: (_key: string, value: string) => {
        stored = value;
      },
    };
  };
  bindThemeSelector({ select, system, root, storage });
  const choose = (value: string) => {
    select.value = value;
    select.dispatchEvent(new Event('change'));
  };
  const os = (dark: boolean) => {
    system.matches = dark;
    system.dispatchEvent(new Event('change'));
  };
  return { select, root, choose, os, saved: () => stored };
}
test('theme selector switches immediately, persists choices and resumes system changes', () => {
  const t = setup();
  assert.equal(t.select.value, 'system');
  t.choose('dark');
  assert.equal(t.root.dataset.theme, 'dark');
  assert.equal(t.saved(), 'dark');
  t.choose('light');
  t.os(true);
  assert.equal(t.root.dataset.theme, 'light');
  t.choose('system');
  assert.equal(t.saved(), 'system');
  assert.equal(t.root.dataset.theme, 'dark');
  t.os(false);
  assert.equal(t.root.dataset.theme, 'light');
});
test('saved explicit themes restore independently of initial page appearance', () => {
  const t = setup('dark');
  assert.equal(t.select.value, 'dark');
  assert.equal(t.root.dataset.theme, 'dark');
  t.os(false);
  assert.equal(t.root.dataset.theme, 'dark');
});
test('invalid stored themes fall back to system and blocked storage permits changes', () => {
  assert.equal(setup('invalid').select.value, 'system');
  const t = setup(null, true);
  t.choose('dark');
  assert.equal(t.root.dataset.theme, 'dark');
  t.os(false);
  assert.equal(t.root.dataset.theme, 'dark');
});
