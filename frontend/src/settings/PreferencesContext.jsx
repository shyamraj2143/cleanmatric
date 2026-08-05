import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { storage } from '../utils/storage'

const STORAGE_KEY = 'metricflow_preferences'
const DEFAULT_PREFERENCES = {
  theme: 'system',
  sidebar_mode: 'expanded',
  email_notifications: true,
  analysis_completed_notifications: true,
  default_export_format: 'csv',
  rows_per_page: 10,
}

const readPreferences = () => {
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(storage.getItem(STORAGE_KEY) || '{}') }
  } catch {
    storage.removeItem(STORAGE_KEY)
    return DEFAULT_PREFERENCES
  }
}

const resolveTheme = (theme) => theme === 'system'
  ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  : theme

export function applyInitialTheme() {
  const preferences = readPreferences()
  document.documentElement.dataset.theme = resolveTheme(preferences.theme)
  document.documentElement.style.colorScheme = resolveTheme(preferences.theme)
}

const PreferencesContext = createContext(null)

export function PreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(readPreferences)

  const updatePreferences = useCallback((patch) => {
    setPreferences((current) => {
      const next = { ...current, ...patch }
      storage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  useEffect(() => {
    const apply = () => {
      const theme = resolveTheme(preferences.theme)
      document.documentElement.dataset.theme = theme
      document.documentElement.style.colorScheme = theme
    }
    apply()
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (preferences.theme === 'system') media?.addEventListener?.('change', apply)
    return () => media?.removeEventListener?.('change', apply)
  }, [preferences.theme])

  const value = useMemo(() => ({ preferences, updatePreferences }), [preferences, updatePreferences])
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider.')
  return context
}

export { DEFAULT_PREFERENCES, STORAGE_KEY }
