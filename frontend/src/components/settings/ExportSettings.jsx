import React, { useEffect, useState } from 'react'
import { ErrorState, LoadingState } from '../dashboard/States'

export default function ExportSettings({ settings, loading, error, onRetry, onSave }) {
  const [form, setForm] = useState({ default_export_format: 'csv', rows_per_page: 10 })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { if (settings) setForm({ default_export_format: settings.default_export_format || 'csv', rows_per_page: Number(settings.rows_per_page) || 10 }) }, [settings])
  const submit = async (event) => { event.preventDefault(); setSaving(true); setMessage(''); try { await onSave(form); setMessage('Data and export preferences saved.') } catch (requestError) { setMessage(requestError.message) } finally { setSaving(false) } }
  if (loading) return <LoadingState label="Loading data preferences…" rows={4} />
  if (error && !settings) return <ErrorState title="Data settings unavailable" message={error} onRetry={onRetry} />
  return <article className="settings-panel"><div className="settings-heading"><h2>Data and Export</h2><p>Set report defaults and analysis history density.</p></div><form className="settings-form" onSubmit={submit}><div className="settings-form-grid"><label>Default export format<select value={form.default_export_format} onChange={(event) => setForm((current) => ({ ...current, default_export_format: event.target.value }))}><option value="csv">CSV</option><option value="xlsx">Excel workbook</option><option value="json">JSON package</option><option value="pdf">PDF quality report</option></select></label><label>Rows per history page<select value={form.rows_per_page} onChange={(event) => setForm((current) => ({ ...current, rows_per_page: Number(event.target.value) }))}>{[5, 10, 20, 50].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><div className="upload-policy"><div><span>Accepted upload types</span><strong>CSV · TSV · XLSX · JSON · TXT · LOG</strong></div><div><span>Maximum upload size</span><strong>20 MB</strong></div></div>{message && <p className={`settings-message ${message.includes('saved') ? 'success' : 'error'}`} role="status">{message}</p>}<div className="settings-form-actions"><button className="primary-action-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save preferences'}</button></div></form></article>
}
