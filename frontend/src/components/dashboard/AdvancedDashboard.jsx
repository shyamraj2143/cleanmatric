import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { analysisApi, saveBlob } from '../../services/api'
import { usePreferences } from '../../settings/PreferencesContext'
import { formatBytes, formatDate, formatNumber } from '../../utils/analysis'
import { EmptyState, ErrorState } from './States'

const STATUS_COLORS = { SUCCESS: '#35a273', FAILED: '#d85a70', WARNING: '#dfa041', UNKNOWN: '#8490a5' }
const FILE_COLORS = ['#6373f2', '#52a4d8', '#8a78e5']

const summaryCards = [
  ['total_analyses', 'Total Analyses', 'Files processed', '▤', 'analyses'],
  ['total_records', 'Total Records', 'Across all analyses', '∑', 'records'],
  ['success_count', 'Success', 'success_percentage', '✓', 'success'],
  ['failed_count', 'Failed', 'failed_percentage', '×', 'failed'],
  ['warning_count', 'Warning', 'warning_percentage', '!', 'warning'],
  ['unknown_count', 'Unknown', 'unknown_percentage', '?', 'unknown'],
  ['duplicates_removed', 'Duplicates Removed', 'Data quality improvement', '≡', 'duplicates'],
]

export function DashboardMetricCard({ label, value, support, icon, tone }) {
  return <article className={`dashboard-summary-card ${tone}`}><span className="summary-card-icon" aria-hidden="true">{icon}</span><div><p>{label}</p><strong>{formatNumber(value)}</strong><small>{typeof support === 'number' ? `${support.toFixed(1)}% of records` : support}</small></div></article>
}

export function DashboardMetricsGrid({ summary, loading, error, onRetry }) {
  if (loading) return <section className="dashboard-summary-grid" aria-label="Loading dashboard summary">{summaryCards.map(([, label]) => <div className="dashboard-summary-card skeleton-card" key={label}><i /><i /><i /></div>)}</section>
  if (error) return <ErrorState title="Summary unavailable" message={error} onRetry={onRetry} />
  if (!summary?.hasData) return <EmptyState title="No dashboard data" message="Your summary will appear after the first file analysis." />
  return <section className="dashboard-summary-grid" aria-label="Dashboard summary">{summaryCards.map(([key, label, support, icon, tone]) => <DashboardMetricCard key={key} label={label} value={summary[key]} support={support.endsWith?.('_percentage') ? summary[support] : support} icon={icon} tone={tone} />)}</section>
}

function ChartShell({ title, subtitle, loading, error, empty, onRetry, action, children }) {
  return <article className="panel advanced-chart-card"><div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>{loading ? <div className="chart-skeleton" role="status" aria-label={`Loading ${title}`}><i /><i /><i /><i /></div> : error ? <ErrorState title={`${title} unavailable`} message={error} onRetry={onRetry} /> : empty ? <EmptyState title="No chart data" message="There is not enough analysis data to draw this chart yet." /> : children}</article>
}

export function DashboardStatusChart({ data = [], ...state }) {
  const supplied = new Map(data.map((item) => [item.name.toUpperCase(), item.value]))
  const chartData = data.length ? ['SUCCESS', 'FAILED', 'WARNING', 'UNKNOWN'].map((name) => ({ name, value: supplied.get(name) || 0 })) : []
  return <ChartShell title="Status Distribution" subtitle="Record outcomes across analyses" empty={!chartData.length} {...state}><div className="advanced-chart" role="img" aria-label="Donut chart of success, failed, warning, and unknown records"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius="54%" outerRadius="78%" paddingAngle={2}>{chartData.map((item) => <Cell key={item.name} fill={STATUS_COLORS[item.name]} />)}</Pie><Tooltip formatter={(value) => [formatNumber(value), 'Records']} /><Legend /></PieChart></ResponsiveContainer></div></ChartShell>
}

export function DashboardTrendChart({ data = [], range, onRangeChange, ...state }) {
  const selector = <label className="range-selector"><span className="visually-hidden">Trend range</span><select value={range} onChange={(event) => onRangeChange(event.target.value)}><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option></select></label>
  return <ChartShell title="Analysis Trend" subtitle="Analysis and record volume over time" action={selector} empty={!data.length} {...state}><div className="advanced-chart" role="img" aria-label="Area chart of analysis activity over time"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 12, right: 12, left: -20, bottom: 4 }}><defs><linearGradient id="dashboardTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6373f2" stopOpacity={0.28} /><stop offset="95%" stopColor="#6373f2" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Area name="Analyses" type="monotone" dataKey="analyses" stroke="#6373f2" strokeWidth={3} fill="url(#dashboardTrend)" /><Area name="Records" type="monotone" dataKey="records" stroke="#35a273" fillOpacity={0} /></AreaChart></ResponsiveContainer></div></ChartShell>
}

export function DashboardFileTypeChart({ data = [], ...state }) {
  const supplied = new Map(data.map((item) => [item.name.toUpperCase(), item.value]))
  const chartData = data.length ? ['CSV', 'TXT', 'LOG'].map((name) => ({ name, value: supplied.get(name) || 0 })) : []
  return <ChartShell title="File Type Distribution" subtitle="Analyses grouped by uploaded format" empty={!chartData.length} {...state}><div className="advanced-chart" role="img" aria-label="Bar chart of CSV, TXT, and LOG analyses"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 12, right: 10, left: -22, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar name="Analyses" dataKey="value" radius={[6, 6, 0, 0]}>{chartData.map((item, index) => <Cell key={item.name} fill={FILE_COLORS[index]} />)}</Bar></BarChart></ResponsiveContainer></div></ChartShell>
}

export function ProcessingQuality({ summary, loading, error, onRetry }) {
  return <article className="panel processing-quality"><div className="panel-heading"><div><h2>Processing Quality</h2><p>Cleaning results across analyzed files</p></div></div>{loading ? <div className="quality-skeleton"><i /><i /><i /></div> : error ? <ErrorState title="Quality unavailable" message={error} onRetry={onRetry} /> : !summary?.hasData ? <EmptyState title="No quality data" message="Quality metrics will appear after an analysis." /> : <div className="quality-stats"><div><span>Cleaned records</span><strong>{formatNumber(summary.cleaned_records)}</strong></div><div><span>Duplicates removed</span><strong>{formatNumber(summary.duplicates_removed)}</strong></div><div><span>Invalid records</span><strong>{formatNumber(summary.invalid_records)}</strong></div></div>}</article>
}

export function LatestAnalysisCard({ analysis, loading, error, onRetry }) {
  const { preferences } = usePreferences()
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const downloadReport = async () => {
    if (!analysis?.analysis_id || downloading) return
    setDownloading(true); setDownloadError('')
    try {
      const result = preferences.default_export_format === 'xlsx' ? await analysisApi.downloadXlsx(analysis.analysis_id) : await analysisApi.downloadCsv(analysis.analysis_id)
      saveBlob(result)
    } catch (requestError) { setDownloadError(requestError.message) } finally { setDownloading(false) }
  }
  if (loading) return <article className="panel latest-analysis-card"><div className="latest-skeleton"><i /><i /><i /><i /></div></article>
  if (error) return <ErrorState title="Latest analysis unavailable" message={error} onRetry={onRetry} />
  if (!analysis) return <article className="panel latest-analysis-card"><EmptyState title="No analyses yet" message="Upload your first CSV, TXT, or LOG file." action={<Link className="primary-action-link" to="/dashboard/upload">Upload a file</Link>} /></article>
  return <article className="panel latest-analysis-card"><div className="panel-heading"><div><h2>Latest Analysis</h2><p>Most recently processed file</p></div><span className={`status-badge ${analysis.processing_status}`}>{analysis.processing_status}</span></div><div className="latest-file"><span className="file-type-icon" aria-hidden="true">{String(analysis.file_type).toUpperCase()}</span><div><strong>{analysis.filename}</strong><small>{formatBytes(analysis.file_size)} · {formatDate(analysis.created_at)}</small></div></div><dl className="latest-details"><div><dt>Total records</dt><dd>{formatNumber(analysis.metrics.total_records)}</dd></div><div><dt>Duplicates removed</dt><dd>{formatNumber(analysis.metrics.duplicates_removed)}</dd></div>{analysis.processing_duration !== undefined && <div><dt>Processing duration</dt><dd>{analysis.processing_duration} ms</dd></div>}</dl><div className="latest-actions"><Link className="secondary-button" to={`/dashboard/analysis/${analysis.analysis_id}`}>View Details</Link><button className="primary-action-button" type="button" disabled={downloading} onClick={downloadReport}>{downloading ? 'Downloading…' : 'Download Report'}</button></div>{downloadError && <p className="inline-error" role="alert">{downloadError}</p>}</article>
}

export function QuickActions({ latestAnalysis }) {
  const { preferences } = usePreferences()
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const downloadLatest = async () => {
    if (!latestAnalysis?.analysis_id || downloading) return
    setDownloading(true); setError('')
    try { saveBlob(preferences.default_export_format === 'xlsx' ? await analysisApi.downloadXlsx(latestAnalysis.analysis_id) : await analysisApi.downloadCsv(latestAnalysis.analysis_id)) } catch (requestError) { setError(requestError.message) } finally { setDownloading(false) }
  }
  return <article className="panel quick-actions-card"><div className="panel-heading"><div><h2>Quick Actions</h2><p>Common workspace tasks</p></div></div><div className="quick-actions-grid"><Link to="/dashboard/upload"><span aria-hidden="true">↑</span><strong>Upload New File</strong></Link><Link to="/dashboard/history"><span aria-hidden="true">◷</span><strong>View History</strong></Link><button type="button" disabled={!latestAnalysis || downloading} onClick={downloadLatest}><span aria-hidden="true">↓</span><strong>{downloading ? 'Downloading…' : 'Download Latest Report'}</strong></button><Link to="/dashboard/settings"><span aria-hidden="true">⚙</span><strong>Open Settings</strong></Link></div>{error && <p className="inline-error" role="alert">{error}</p>}</article>
}
