/*
 * Light / Dark / System choice (Story 7.22). The state is the `data-theme`
 * attribute on `<html>`; CSS does the rest. System = no attribute and no
 * stored key. Remembered per device in localStorage; never sent to the API.
 * The inline script in index.html applies a saved choice before first paint —
 * keep it in step with this file.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'gigbuddy-theme';

/* The two `--background` values, as in index.html's theme-color metas. */
export const THEME_COLOR = { light: '#faf9f5', dark: '#1a1209' } as const;

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (choice === 'system') {
    root.removeAttribute('data-theme');
    for (const meta of metas) {
      const dark = meta.getAttribute('media')?.includes('dark') ?? false;
      meta.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light);
    }
    return;
  }
  root.setAttribute('data-theme', choice);
  for (const meta of metas) meta.setAttribute('content', THEME_COLOR[choice]);
}

export function saveThemeChoice(choice: ThemeChoice): void {
  applyTheme(choice);
  try {
    if (choice === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage unavailable: the theme still changed for this visit.
  }
}
