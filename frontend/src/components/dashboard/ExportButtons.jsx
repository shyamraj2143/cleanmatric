import React, { useState } from 'react'
import { analysisApi, saveBlob } from '../../services/api'

export default function ExportButtons({ analysisId, compact = false }) {
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const formats = compact ? ['csv', 'xlsx'] : ['csv', 'xlsx', 'json', 'pdf']
  const labels = { csv: 'Download Clean CSV', xlsx: 'Download Excel Report', json: 'Download JSON', pdf: 'Download PDF Report' }

  const download = async (format) => {
    if (!analysisId || loading) return
    setLoading(format); setError('')
    try { saveBlob(await analysisApi.downloadExport(analysisId, format)) } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download this export.')
    } finally { setLoading('') }
  }

  return <div className={`export-buttons ${compact ? 'compact' : ''}`}><div className="export-format-row">{formats.map((format) => <button key={format} className={format === 'pdf' ? 'primary-action-button' : 'secondary-button'} type="button" disabled={Boolean(loading)} onClick={() => download(format)}>{loading === format ? 'Downloading…' : compact ? format.toUpperCase() : labels[format]}</button>)}</div>{error && <p role="alert">{error}</p>}</div>
}
