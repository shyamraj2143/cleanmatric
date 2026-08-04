import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { DashboardFileTypeChart, DashboardMetricsGrid, DashboardStatusChart, DashboardTrendChart, LatestAnalysisCard, ProcessingQuality, QuickActions } from '../components/dashboard/AdvancedDashboard'
import RecentAnalysisTable from '../components/dashboard/RecentAnalysisTable'
import { ErrorState, LoadingState } from '../components/dashboard/States'
import { analysisApi, dashboardApi } from '../services/api'
import { normalizeDashboardSummary, normalizeDistribution, normalizeLatestAnalysis, normalizeRecentAnalyses, normalizeTrends } from '../utils/dashboard'

const initialSection = { data: null, loading: true, error: '' }

export default function DashboardPage() {
  const { search = '' } = useOutletContext() || {}
  const [range, setRange] = useState('30d')
  const [trendRetry, setTrendRetry] = useState(0)
  const [sections, setSections] = useState({ summary: initialSection, status: initialSection, fileTypes: initialSection, recent: initialSection, latest: initialSection, trends: initialSection })
  const [deletingId, setDeletingId] = useState(null)
  const coreRequest = useRef(null)

  const updateSection = useCallback((key, patch) => setSections((current) => ({ ...current, [key]: { ...current[key], ...patch } })), [])

  const runRequest = useCallback(async (key, request, normalize, signal) => {
    updateSection(key, { loading: true, error: '' })
    try {
      const payload = await request()
      if (!signal?.aborted) updateSection(key, { data: normalize(payload), loading: false })
    } catch (error) {
      if (error?.name !== 'AbortError' && !signal?.aborted) updateSection(key, { loading: false, error: error.message })
    }
  }, [updateSection])

  const loadCore = useCallback(() => {
    coreRequest.current?.abort()
    const controller = new AbortController()
    coreRequest.current = controller
    const options = { signal: controller.signal }
    Promise.all([
      runRequest('summary', () => dashboardApi.getSummary(options), normalizeDashboardSummary, controller.signal),
      runRequest('status', () => dashboardApi.getStatusDistribution(options), (payload) => normalizeDistribution(payload, 'status'), controller.signal),
      runRequest('fileTypes', () => dashboardApi.getFileTypeDistribution(options), (payload) => normalizeDistribution(payload, 'file'), controller.signal),
      runRequest('recent', () => dashboardApi.getRecentAnalyses(options), normalizeRecentAnalyses, controller.signal),
      runRequest('latest', () => dashboardApi.getLatestAnalysis(options), normalizeLatestAnalysis, controller.signal),
    ])
    return controller
  }, [runRequest])

  useEffect(() => {
    const controller = loadCore()
    return () => controller.abort()
  }, [loadCore])

  useEffect(() => {
    const controller = new AbortController()
    runRequest('trends', () => dashboardApi.getTrends(range, { signal: controller.signal }), normalizeTrends, controller.signal)
    return () => controller.abort()
  }, [range, runRequest, trendRetry])

  const removeAnalysis = async (analysis) => {
    if (!window.confirm(`Delete the analysis for “${analysis.filename}”? This cannot be undone.`)) return
    setDeletingId(analysis.analysis_id)
    try { await analysisApi.deleteAnalysis(analysis.analysis_id); loadCore() } catch (error) { updateSection('recent', { error: error.message }) } finally { setDeletingId(null) }
  }

  const filteredRecent = useMemo(() => {
    const items = sections.recent.data || []
    const term = search.trim().toLowerCase()
    return term ? items.filter((item) => `${item.filename} ${item.file_type} ${item.processing_status}`.toLowerCase().includes(term)) : items
  }, [search, sections.recent.data])

  return <div className="dashboard-stack advanced-dashboard">
    <DashboardMetricsGrid summary={sections.summary.data} loading={sections.summary.loading} error={sections.summary.error} onRetry={loadCore} />
    <section className="dashboard-charts-layout">
      <DashboardStatusChart data={sections.status.data || []} loading={sections.status.loading} error={sections.status.error} onRetry={loadCore} />
      <DashboardTrendChart data={sections.trends.data || []} range={range} onRangeChange={setRange} loading={sections.trends.loading} error={sections.trends.error} onRetry={() => setTrendRetry((current) => current + 1)} />
      <DashboardFileTypeChart data={sections.fileTypes.data || []} loading={sections.fileTypes.loading} error={sections.fileTypes.error} onRetry={loadCore} />
      <ProcessingQuality summary={sections.summary.data} loading={sections.summary.loading} error={sections.summary.error} onRetry={loadCore} />
    </section>
    <section className="dashboard-secondary-grid"><LatestAnalysisCard analysis={sections.latest.data} loading={sections.latest.loading} error={sections.latest.error} onRetry={loadCore} /><QuickActions latestAnalysis={sections.latest.data} /></section>
    {sections.recent.loading ? <LoadingState label="Loading recent analyses…" rows={4} /> : sections.recent.error ? <ErrorState title="Recent analyses unavailable" message={sections.recent.error} onRetry={loadCore} /> : <RecentAnalysisTable analyses={filteredRecent} onDelete={removeAnalysis} deletingId={deletingId} />}
  </div>
}
