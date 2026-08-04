import React, { useCallback, useEffect, useRef, useState } from 'react'
import AppearanceSettings from '../components/settings/AppearanceSettings'
import ExportSettings from '../components/settings/ExportSettings'
import NotificationSettings from '../components/settings/NotificationSettings'
import ProfileSettings from '../components/settings/ProfileSettings'
import SecuritySettings from '../components/settings/SecuritySettings'
import SettingsLayout from '../components/settings/SettingsLayout'
import { settingsApi } from '../services/api'
import { DEFAULT_PREFERENCES, usePreferences } from '../settings/PreferencesContext'

const normalizeSettings = (payload) => payload?.data || payload?.settings || payload || {}

export default function SettingsPage() {
  const [active, setActive] = useState('profile')
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { preferences, updatePreferences } = usePreferences()
  const preferencesRef = useRef(preferences)
  preferencesRef.current = preferences

  const load = useCallback(async (signal) => {
    setLoading(true); setError('')
    try {
      const next = { ...DEFAULT_PREFERENCES, ...preferencesRef.current, ...normalizeSettings(await settingsApi.getSettings({ signal })) }
      setSettings(next); updatePreferences(next)
    } catch (requestError) {
      if (requestError?.name !== 'AbortError') setError(requestError.message)
    } finally { setLoading(false) }
  }, [updatePreferences])

  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort() }, [load])

  const save = async (patch) => {
    const previous = settings || DEFAULT_PREFERENCES
    const optimistic = { ...previous, ...patch }
    setSettings(optimistic); updatePreferences(patch)
    try {
      const response = normalizeSettings(await settingsApi.updateSettings(patch))
      const next = { ...optimistic, ...response }
      setSettings(next); updatePreferences(next)
      return next
    } catch (requestError) {
      setSettings(previous); updatePreferences(previous)
      throw requestError
    }
  }

  const shared = { settings, loading, error, onRetry: () => load(), onSave: save }
  return <SettingsLayout active={active} onChange={setActive}>{active === 'profile' && <ProfileSettings />}{active === 'appearance' && <AppearanceSettings {...shared} />}{active === 'notifications' && <NotificationSettings {...shared} />}{active === 'data-export' && <ExportSettings {...shared} />}{active === 'security' && <SecuritySettings />}</SettingsLayout>
}
