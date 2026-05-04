import { useEffect, useState } from 'react'

export type ThemePreference = 'light' | 'dark'

export const THEME_PREFERENCE_KEY = 'trailread.theme'

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'light'

  try {
    const stored = window.localStorage.getItem(THEME_PREFERENCE_KEY)
    return stored === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyThemePreference(theme: ThemePreference) {
  if (typeof document === 'undefined') return

  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemePreference>(() => getStoredThemePreference())

  useEffect(() => {
    applyThemePreference(theme)
    try {
      window.localStorage.setItem(THEME_PREFERENCE_KEY, theme)
    } catch {
      /* private mode */
    }
  }, [theme])

  return [theme, setTheme] as const
}
