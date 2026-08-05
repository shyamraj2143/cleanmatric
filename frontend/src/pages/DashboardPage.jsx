import React, { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dashboardApi } from '../services/api'

const palette = ['#1f8a5b', '#71b48d', '#d4a72c', '#d96c4c', '#64748b', '#8b5cf6']
const number = (value) => Number(value || 0).toLocaleString()
const scoreLabel = (score) => score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Needs review' : 'High risk'

export default function DashboardPage() {
  const { search = '' } = useOutletContext() || {}
  const [range, setRange] = useState('30d')
  const [data, setData] = useState({ summary: {}, trends: [], files: [], recent: [], latest: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    Promise.all([
      dashboardApi.getSummary({ signal: controller.signal }),
      dashboardApi.getTrends(range, { signal: controller.signal }),
      dashboardApi.getFileTypeDistribution({ signal: controller.signal }),
      dashboardApi.getRecentAnalyses({ signal: controller.signal }),
      dashboardApi.getLatestAnalysis({ signal: controller.signal }),
    ]).then(([summary, trends, files, recent, latest]) => {
      const trendItems = Array.isArray(trends) ? trends : trends?.data || []
      const fileItems = Array.isArray(files) ? files.map((item) => ({ name: item.name || String(item.file_type || '').toUpperCase(), value: item.value ?? item.count ?? 0 })) : files?.data || []
      const recentItems = Array.isArray(recent) ? recent : recent?.items || []
      const latestItem = latest?.analysis ?? (Array.isArray(latest) ? latest[0] : latest) ?? null
      setData({ summary: summary || {}, trends: trendItems, files: fileItems, recent: recentItems, latest: latestItem })
    }).catch((requestError) => {
      if (requestError.name !== 'AbortError') setError(requestError.message)
    }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [range])

  const recent = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term ? data.recent.filter((item) => `${item.filename} ${item.file_type}`.toLowerCase().includes(term)) : data.recent
  }, [data.recent, search])
  const summary = data.summary || {}
  const hasSummary = Object.values(summary).some((value) => Number(value) > 0)

  if (loading) return <div className="dashboard-loading-grid">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div>
  if (error) return <div className="clean-alert error"><strong>Dashboard unavailable</strong><span>{error}</span></div>

  return <div className="quality-dashboard">
    <section className="dashboard-welcome"><div><p className="clean-kicker">QUALITY COMMAND CENTER</p><h2>Your data, measured for trust.</h2><p>Monitor cleaning volume, quality trends, missing values, duplicates, outliers, and recent exports.</p></div><Link to="/dashboard/upload">New analysis <span>→</span></Link></section>

    {!hasSummary && <div className="clean-empty-state">No dashboard data</div>}
    <section className="command-metrics">
      <article><span className="metric-icon">◫</span><div><small>Total Analyses</small><strong>{number(summary.total_analyses)}</strong><p>datasets processed</p></div></article>
      <article><span className="metric-icon">≡</span><div><small>Clean rows</small><strong>{number(summary.total_records)}</strong><p>ready for export</p></div></article>
      <article className="quality-feature"><span className="metric-icon">✓</span><div><small>Average quality</small><strong>{summary.average_quality_score || 0}%</strong><p>{scoreLabel(summary.average_quality_score || 0)}</p></div></article>
      <article><span className="metric-icon">⊘</span><div><small>Duplicates removed</small><strong>{number(summary.duplicates_removed)}</strong><p>redundant rows</p></div></article>
      <article><span className="metric-icon">◇</span><div><small>Missing values</small><strong>{number(summary.missing_values_count)}</strong><p>cells still blank</p></div></article>
      <article><span className="metric-icon">⌁</span><div><small>Outliers detected</small><strong>{number(summary.outliers_detected)}</strong><p>numeric anomalies</p></div></article>
    </section>

    <section className="command-chart-grid">
      <article className="report-panel wide"><div className="panel-title-row"><div><h3>Quality and processing trend</h3><p>Daily analysis volume and average quality score</p></div><select aria-label="Trend range" value={range} onChange={(event) => setRange(event.target.value)}><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option></select></div>{data.trends.length ? <ResponsiveContainer width="100%" height={300}><AreaChart data={data.trends}><defs><linearGradient id="qualityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1f8a5b" stopOpacity={0.35} /><stop offset="95%" stopColor="#1f8a5b" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" /><YAxis yAxisId="left" allowDecimals={false} /><YAxis yAxisId="right" orientation="right" domain={[0, 100]} /><Tooltip /><Area yAxisId="left" type="monotone" dataKey="records" stroke="#557b68" fill="#dcebe3" name="Clean rows" /><Area yAxisId="right" type="monotone" dataKey="quality_score" stroke="#1f8a5b" fill="url(#qualityFill)" name="Quality score" /></AreaChart></ResponsiveContainer> : <div className="chart-empty">Run your first analysis to build a trend.</div>}</article>
      <article className="report-panel"><div className="panel-title-row"><div><h3>File formats</h3><p>Uploaded datasets by type</p></div></div>{data.files.length ? <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={data.files} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={4}>{data.files.map((entry, index) => <Cell key={entry.name} fill={palette[index % palette.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <div className="chart-empty">No file data yet.</div>}<div className="chart-legend">{data.files.map((item, index) => <span key={item.name}><i style={{ background: palette[index % palette.length] }} />{item.name}: {item.value}</span>)}</div></article>
    </section>

    <section className="dashboard-secondary-grid"><article className="report-panel latest-quality"><div className="panel-title-row"><div><h3>Latest analysis</h3><p>Most recently processed dataset</p></div></div>{data.latest ? <div className="latest-quality-card"><div><strong>{data.latest.filename}</strong><span>{String(data.latest.file_type || "").toUpperCase()} · {number(data.latest.total_records || data.latest.metrics?.total_records)} rows</span></div><span className="quality-chip good">{data.latest.quality_score || data.latest.metrics?.quality_score || 0}%</span><Link to={`/dashboard/analysis/${data.latest.id || data.latest.analysis_id}`}>View report →</Link></div> : <div className="chart-empty">No analyses yet</div>}</article><article className="report-panel"><div className="panel-title-row"><div><h3>Quality readiness</h3><p>Average score across completed datasets</p></div></div>{hasSummary ? <div className="quality-readiness"><strong>{summary.average_quality_score || 0}%</strong><span>{scoreLabel(summary.average_quality_score || 0)}</span></div> : <div className="chart-empty">No quality data</div>}</article></section>

    <section className="report-panel recent-quality"><div className="panel-title-row"><div><h3>Recent analyses</h3><p>Latest datasets and their quality score</p></div><Link to="/dashboard/history">Open history →</Link></div><div className="report-table-wrap"><table><thead><tr><th>Dataset</th><th>Type</th><th>Rows</th><th>Quality</th><th>Duplicates</th><th>Created</th><th /></tr></thead><tbody>{recent.length ? recent.map((item) => <tr key={item.id || item.analysis_id}><td><strong>{item.filename}</strong></td><td><span className="type-pill">{String(item.file_type).toUpperCase()}</span></td><td>{number(item.total_records)}</td><td><span className={`quality-chip ${item.quality_score >= 80 ? 'good' : item.quality_score >= 60 ? 'medium' : 'low'}`}>{item.quality_score || 0}%</span></td><td>{number(item.duplicates_removed)}</td><td>{new Date(item.created_at).toLocaleDateString()}</td><td><Link to={`/dashboard/analysis/${item.id || item.analysis_id}`}>View →</Link></td></tr>) : <tr><td colSpan="7"><span>No analyses yet</span><small> Upload a dataset to get started.</small></td></tr>}</tbody></table></div></section>
  </div>
}
