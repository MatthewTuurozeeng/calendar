// Light/dark appearance. A per-device choice kept in localStorage, applied as
// <html data-theme="light|dark">; index.css redefines the color tokens for dark.
// index.html sets it before first paint with the same rules, so there's no flash.

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'theme'
const THEME_COLORS = { light: '#FAF8F6', dark: '#19181B' }
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Storage can be blocked (private mode); fall back to the system theme.
  }
  return 'system'
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Still applies for this visit.
  }
  applyTheme(preference)
}

function applyTheme(preference = getThemePreference()) {
  const theme = preference === 'dark' || (preference === 'system' && systemDark.matches) ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  // The browser and Android status bar colour.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

/** Applies the saved theme and follows OS changes while it's "system". Call once at startup. */
export function setUpTheme() {
  applyTheme()
  systemDark.addEventListener('change', () => applyTheme())
}
