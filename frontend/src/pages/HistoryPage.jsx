import React, { useCallback, useEffect, useState } from 'react'
import RecentAnalysisTable from '../components/dashboard/RecentAnalysisTable'
import { ErrorState, LoadingState } from '../components/dashboard/States'
import { analysisApi } from '../services/api'
import { getAnalysisPage } from '../utils/analysis'
import { usePreferences } from '../settings/PreferencesContext'

export default function HistoryPage() {
  const { preferences } = usePreferences()
  const pageSize = Number(preferences.rows_per_page) || 10
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, pageSize })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const load = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    try {
      const payload = await analysisApi.getAnalyses(page, pageSize, { signal })
      setData(getAnalysisPage(payload))
    } catch (requestError) {
      if (requestError?.name !== 'AbortError') setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const remove = async (analysis) => {
    if (!window.confirm(`Delete the analysis for “${analysis.filename}”? This cannot be undone.`)) return
    setDeletingId(analysis.analysis_id)
    setError('')
    try {
      await analysisApi.deleteAnalysis(analysis.analysis_id)
      if (data.items.length === 1 && page > 1) setPage((current) => current - 1)
      else await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / (data.pageSize || pageSize)))
  return <div className="dashboard-stack"><div className="page-intro"><h2>Analysis history</h2><p>Review, export, or remove analyses belonging to your account.</p></div>{error && <ErrorState title="History request failed" message={error} onRetry={() => load()} />}{loading ? <LoadingState label="Loading analysis history…" rows={5} /> : <><RecentAnalysisTable analyses={data.items} onDelete={remove} deletingId={deletingId} title="All analyses" /><nav className="pagination" aria-label="Analysis history pages"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></nav></>}</div>
}
