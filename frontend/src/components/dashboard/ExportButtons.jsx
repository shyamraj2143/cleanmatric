import React, { useState } from 'react'
import { analysisApi, saveBlob } from '../../services/api'

export default function ExportButtons({ analysisId, compact = false }) {
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')

  const download = async (format) => {
    if (!analysisId || loading) return
    setLoading(format)
    setError('')
    try {
      const file = format === 'csv' ? await analysisApi.downloadCsv(analysisId) : await analysisApi.downloadXlsx(analysisId)
      saveBlob(file)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download this export.')
    } finally {
      setLoading('')
    }
  }

  return <div className={`export-buttons ${compact ? 'compact' : ''}`}><button className="secondary-button" type="button" disabled={Boolean(loading)} onClick={() => download('csv')}>{loading === 'csv' ? 'Downloading…' : compact ? 'CSV' : 'Download Clean CSV'}</button><button className="primary-action-button" type="button" disabled={Boolean(loading)} onClick={() => download('xlsx')}>{loading === 'xlsx' ? 'Downloading…' : compact ? 'Excel' : 'Download Excel Report'}</button>{error && <p role="alert">{error}</p>}</div>
}
