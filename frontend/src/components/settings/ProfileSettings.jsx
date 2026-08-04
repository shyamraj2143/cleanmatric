import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { settingsApi } from '../../services/api'
import { formatDate } from '../../utils/analysis'
import { ErrorState, LoadingState } from '../dashboard/States'

const normalizeProfile = (payload) => payload?.data || payload?.profile || payload || {}

export default function ProfileSettings() {
  const { updateUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async (signal) => {
    setLoading(true); setError('')
    try {
      const next = normalizeProfile(await settingsApi.getProfile({ signal }))
      setProfile(next)
      setName(next.full_name || next.name || '')
    } catch (requestError) {
      if (requestError?.name !== 'AbortError') setError(requestError.message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort() }, [load])

  const save = async (event) => {
    event.preventDefault()
    const fullName = name.trim()
    if (fullName.length < 2) { setError('Full name must contain at least 2 characters.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const updated = normalizeProfile(await settingsApi.updateProfile({ full_name: fullName }))
      const next = { ...profile, ...updated, full_name: updated.full_name || fullName }
      setProfile(next); setName(next.full_name); updateUser({ name: next.full_name, full_name: next.full_name })
      setSuccess('Profile updated successfully.')
    } catch (requestError) { setError(requestError.message) } finally { setSaving(false) }
  }

  if (loading) return <LoadingState label="Loading profile…" rows={4} />
  if (!profile && error) return <ErrorState title="Profile unavailable" message={error} onRetry={() => load()} />
  const displayName = profile?.full_name || profile?.name || 'MetricFlow user'
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return <article className="settings-panel"><div className="settings-heading"><h2>Profile</h2><p>Manage your account identity and contact information.</p></div><div className="profile-summary"><span className="settings-avatar" aria-hidden="true">{initials}</span><div><strong>{displayName}</strong><span>{profile?.email || 'Email unavailable'}</span><small>Member since {formatDate(profile?.created_at || profile?.account_created_at)}</small></div></div><form className="settings-form" onSubmit={save}><label>Full name<input type="text" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength="2" maxLength="120" required /></label><label>Email<input type="email" value={profile?.email || ''} readOnly aria-readonly="true" /></label><p className="field-help">Email changes require backend verification and are not enabled here.</p>{error && <p className="settings-message error" role="alert">{error}</p>}{success && <p className="settings-message success" role="status">{success}</p>}<div className="settings-form-actions"><button className="primary-action-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button></div></form></article>
}
