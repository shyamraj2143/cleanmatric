import React, { useState } from 'react'
import { ErrorState, LoadingState } from '../dashboard/States'

function SettingSwitch({ label, description, checked, disabled, onChange, badge }) {
  return <label className={`switch-row ${disabled ? 'disabled' : ''}`}><span><strong>{label} {badge && <em>{badge}</em>}</strong><small>{description}</small></span><span className="switch-control"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></span></label>
}

export default function NotificationSettings({ settings, loading, error, onRetry, onSave }) {
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')
  const change = async (key, value) => { setSaving(key); setMessage(''); try { await onSave({ [key]: value }); setMessage('Notification preferences saved.') } catch (requestError) { setMessage(requestError.message) } finally { setSaving('') } }
  if (loading) return <LoadingState label="Loading notifications…" rows={4} />
  if (error && !settings) return <ErrorState title="Notifications unavailable" message={error} onRetry={onRetry} />
  const exportSupported = Object.prototype.hasOwnProperty.call(settings || {}, 'export_completed_notifications')
  return <article className="settings-panel"><div className="settings-heading"><h2>Notifications</h2><p>Control which account and analysis events generate notifications.</p></div><div className="switch-list"><SettingSwitch label="Email notifications" description="Allow MetricFlow to send account notifications by email." checked={Boolean(settings?.email_notifications)} disabled={saving === 'email_notifications'} onChange={(value) => change('email_notifications', value)} /><SettingSwitch label="Analysis completed" description="Notify me when file analysis has completed." checked={Boolean(settings?.analysis_completed_notifications)} disabled={saving === 'analysis_completed_notifications'} onChange={(value) => change('analysis_completed_notifications', value)} /><SettingSwitch label="Export completed" description={exportSupported ? 'Notify me when an export is ready.' : 'Backend support is not currently available.'} badge={exportSupported ? '' : 'Coming soon'} checked={Boolean(settings?.export_completed_notifications)} disabled={!exportSupported || saving === 'export_completed_notifications'} onChange={(value) => change('export_completed_notifications', value)} /></div>{message && <p className={`settings-message ${message.includes('saved') ? 'success' : 'error'}`} role="status">{message}</p>}</article>
}
