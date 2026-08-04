import React, { useState } from 'react'
import { ErrorState, LoadingState } from '../dashboard/States'

export default function AppearanceSettings({ settings, loading, error, onRetry, onSave }) {
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')
  const change = async (key, value) => {
    setSaving(key); setMessage('')
    try { await onSave({ [key]: value }); setMessage('Appearance saved.') } catch (requestError) { setMessage(requestError.message) } finally { setSaving('') }
  }
  if (loading) return <LoadingState label="Loading appearance…" rows={4} />
  if (error && !settings) return <ErrorState title="Appearance unavailable" message={error} onRetry={onRetry} />
  return <article className="settings-panel"><div className="settings-heading"><h2>Appearance</h2><p>Choose how MetricFlow looks and how much sidebar space it uses.</p></div><fieldset className="settings-fieldset"><legend>Theme</legend><div className="choice-grid">{[['system', 'System', 'Follow your device'], ['light', 'Light', 'Bright workspace'], ['dark', 'Dark', 'Low-light workspace']].map(([value, label, help]) => <label key={value} className={settings?.theme === value ? 'choice-card selected' : 'choice-card'}><input type="radio" name="theme" value={value} checked={settings?.theme === value} disabled={saving === 'theme'} onChange={() => change('theme', value)} /><span><strong>{label}</strong><small>{help}</small></span></label>)}</div></fieldset><fieldset className="settings-fieldset"><legend>Sidebar</legend><div className="choice-grid two">{[['expanded', 'Expanded', 'Show icons and labels'], ['compact', 'Compact', 'Maximize workspace width']].map(([value, label, help]) => <label key={value} className={settings?.sidebar_mode === value ? 'choice-card selected' : 'choice-card'}><input type="radio" name="sidebar" value={value} checked={settings?.sidebar_mode === value} disabled={saving === 'sidebar_mode'} onChange={() => change('sidebar_mode', value)} /><span><strong>{label}</strong><small>{help}</small></span></label>)}</div></fieldset>{message && <p className={`settings-message ${message.includes('saved') ? 'success' : 'error'}`} role="status">{message}</p>}</article>
}
