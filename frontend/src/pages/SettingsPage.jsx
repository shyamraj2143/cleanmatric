import React, { useCallback, useEffect, useRef, useState } from 'react'
import AppearanceSettings from '../components/settings/AppearanceSettings'
import ExportSettings from '../components/settings/ExportSettings'
import NotificationSettings from '../components/settings/NotificationSettings'
import ProfileSettings from '../components/settings/ProfileSettings'
import SecuritySettings from '../components/settings/SecuritySettings'
import SettingsLayout from '../components/settings/SettingsLayout'
import { settingsApi } from '../services/api'
import { DEFAULT_PREFERENCES, usePreferences } from '../settings/PreferencesContext'

const unwrap = (payload) => payload?.data || payload?.settings || payload || {}
const fromApi = (payload) => {
  const value = unwrap(payload)
  return {
    theme: value.theme ?? 'system',
    sidebar_mode: value.compact_sidebar ? 'compact' : 'expanded',
    email_notifications: Boolean(value.email_notifications),
    analysis_completed_notifications: Boolean(value.analysis_notifications),
    default_export_format: value.export_format || 'csv',
    rows_per_page: Number(value.rows_per_page) || 10,
  }
}
const toApi = (patch) => {
  const result = { ...patch }
  if (Object.prototype.hasOwnProperty.call(result, 'sidebar_mode')) {
    result.compact_sidebar = result.sidebar_mode === 'compact'
    delete result.sidebar_mode
  }
  if (Object.prototype.hasOwnProperty.call(result, 'analysis_completed_notifications')) {
    result.analysis_notifications = result.analysis_completed_notifications
    delete result.analysis_completed_notifications
  }
  if (Object.prototype.hasOwnProperty.call(result, 'default_export_format')) {
    result.export_format = result.default_export_format
    delete result.default_export_format
  }
  return result
}

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
      const next = { ...DEFAULT_PREFERENCES, ...preferencesRef.current, ...fromApi(await settingsApi.getSettings({ signal })) }
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
      const response = fromApi(await settingsApi.updateSettings(toApi(patch)))
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
