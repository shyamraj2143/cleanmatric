import React, { useRef, useState } from 'react'
import { settingsApi } from '../../services/api'

export default function SecuritySettings() {
  const formRef = useRef(null)
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const toggle = (key) => setVisible((current) => ({ ...current, [key]: !current[key] }))
  const submit = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const currentPassword = String(formData.get('current_password') || '')
    const newPassword = String(formData.get('new_password') || '')
    const confirmPassword = String(formData.get('confirm_password') || '')
    setError(''); setSuccess('')
    if (newPassword.length < 8) { setError('New password must contain at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setError('New password and confirmation do not match.'); return }
    setSaving(true)
    try { await settingsApi.changePassword({ current_password: currentPassword, new_password: newPassword }); formRef.current?.reset(); setVisible({ current: false, next: false, confirm: false }); setSuccess('Password changed successfully.') } catch (requestError) { setError(requestError.message) } finally { setSaving(false) }
  }
  const passwordField = (name, label, key, autoComplete) => <label>{label}<span className="settings-password-field"><input type={visible[key] ? 'text' : 'password'} name={name} autoComplete={autoComplete} minLength={key === 'current' ? undefined : 8} required /><button type="button" onClick={() => toggle(key)} aria-label={`${visible[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`}>{visible[key] ? 'Hide' : 'Show'}</button></span></label>
  return <article className="settings-panel"><div className="settings-heading"><h2>Security</h2><p>Change your password using the same security rules as account registration.</p></div><form ref={formRef} className="settings-form security-form" onSubmit={submit}>{passwordField('current_password', 'Current password', 'current', 'current-password')}{passwordField('new_password', 'New password', 'next', 'new-password')}{passwordField('confirm_password', 'Confirm new password', 'confirm', 'new-password')}{error && <p className="settings-message error" role="alert">{error}</p>}{success && <p className="settings-message success" role="status">{success}</p>}<div className="settings-form-actions"><button className="primary-action-button" type="submit" disabled={saving}>{saving ? 'Changing…' : 'Change password'}</button></div></form></article>
}
