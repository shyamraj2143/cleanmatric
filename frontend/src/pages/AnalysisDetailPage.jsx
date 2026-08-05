import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { analysisApi, saveBlob } from '../services/api'

const palette = ['#1f8a5b', '#4f9c7b', '#d4a72c', '#d96c4c', '#64748b', '#8b5cf6']
const formatBytes = (bytes = 0) => bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(2)} MB`
const formatDate = (value) => value ? new Date(value).toLocaleString() : '—'

function ScoreRing({ score = 0 }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0))
  return <div className="score-ring" style={{ '--score': `${value * 3.6}deg` }}><div><strong>{value}</strong><span>Quality score</span></div></div>
}

function ExportBar({ analysisId }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const download = async (format) => {
    if (busy) return
    setBusy(format); setError('')
    try { saveBlob(await analysisApi.downloadExport(analysisId, format)) } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }
  return <div className="report-export"><span>Export cleaned result</span><div>{['csv', 'xlsx', 'json', 'pdf'].map((format) => <button key={format} type="button" disabled={Boolean(busy)} onClick={() => download(format)}>{busy === format ? '…' : format.toUpperCase()}</button>)}</div>{error && <small role="alert">{error}</small>}</div>
}

function DataTable({ analysisId, initialColumns = [], initialRows = [] }) {
  const [rows, setRows] = useState(initialRows)
  const [columns, setColumns] = useState(initialColumns)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(initialRows.length)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      analysisApi.getRecords(analysisId, { page, pageSize: 50, search, signal: controller.signal }).then((payload) => {
        setRows(payload.items || []); setColumns(payload.columns || []); setTotal(payload.total || 0)
      }).catch((error) => { if (error.name !== 'AbortError') setRows([]) }).finally(() => setLoading(false))
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [analysisId, page, search])

  const pages = Math.max(1, Math.ceil(total / 50))
  return <section className="report-panel data-browser"><div className="panel-title-row"><div><h3>Cleaned data preview</h3><p>{total.toLocaleString()} matching rows · 50 rows per page</p></div><label className="data-search"><span>⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search any value" /></label></div>
    <div className="report-table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={Math.max(columns.length, 1)}>Loading records…</td></tr> : rows.length ? rows.map((row, index) => <tr key={`${page}-${index}`}>{columns.map((column) => <td key={column} title={String(row[column] ?? '')}>{String(row[column] ?? '') || <em>blank</em>}</td>)}</tr>) : <tr><td colSpan={Math.max(columns.length, 1)}>No matching records.</td></tr>}</tbody></table></div>
    <div className="table-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next →</button></div>
  </section>
}

export default function AnalysisDetailPage() {
  const { analysisId } = useParams()
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    analysisApi.getAnalysisById(analysisId, { signal: controller.signal }).then(setAnalysis).catch((requestError) => {
      if (requestError.name !== 'AbortError') setError(requestError.message)
    }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [analysisId])

  const profiles = analysis?.metrics?.column_profiles || []
  const missingData = useMemo(() => profiles.filter((item) => item.missing_count > 0).slice(0, 12).map((item) => ({ name: item.name, value: item.missing_count })), [profiles])
  const typeData = analysis?.charts?.type_distribution || []
  if (loading) return <div className="report-loading">Building quality report…</div>
  if (error || !analysis) return <div className="clean-alert error"><strong>Could not load analysis.</strong><span>{error || 'Analysis not found.'}</span><Link to="/dashboard/history">Back to history</Link></div>

  const metrics = analysis.metrics || {}
  return <div className="quality-report">
    <div className="detail-nav"><Link to="/dashboard/history">← Back to history</Link></div>
    <section className="report-header"><div><p className="clean-kicker">DATA QUALITY REPORT</p><h2>{analysis.filename}</h2><p>{String(analysis.file_type).toUpperCase()} · {formatBytes(analysis.file_size)} · Completed {formatDate(analysis.completed_at)}</p><span className="analysis-id">Analysis ID: {analysis.analysis_id}</span></div><ScoreRing score={metrics.quality_score} /><ExportBar analysisId={analysis.analysis_id} /></section>

    <section className="quality-score-grid">
      {[['Completeness', metrics.completeness_score, `${metrics.missing_values_count || 0} missing cells`], ['Uniqueness', metrics.uniqueness_score, `${metrics.duplicates_removed || 0} duplicates removed`], ['Validity', metrics.validity_score, `${metrics.outliers_detected || 0} potential outliers`], ['Consistency', metrics.consistency_score, `${metrics.column_count || 0} columns profiled`]].map(([label, value, hint]) => <article key={label}><span>{label}</span><strong>{value ?? 0}%</strong><div><i style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} /></div><small>{hint}</small></article>)}
    </section>

    <section className="report-grid two-column">
      <article className="report-panel"><div className="panel-title-row"><div><h3>Missing values</h3><p>Columns needing the most attention</p></div></div>{missingData.length ? <ResponsiveContainer width="100%" height={280}><BarChart data={missingData} margin={{ left: 4, right: 12, top: 12, bottom: 30 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={70} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" radius={[7, 7, 0, 0]} fill="#d4a72c" /></BarChart></ResponsiveContainer> : <div className="chart-empty">No missing values detected 🎯</div>}</article>
      <article className="report-panel"><div className="panel-title-row"><div><h3>Detected data types</h3><p>Automatic schema inference</p></div></div>{typeData.length ? <ResponsiveContainer width="100%" height={280}><PieChart><Pie data={typeData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>{typeData.map((entry, index) => <Cell key={entry.name} fill={palette[index % palette.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <div className="chart-empty">No type distribution available.</div>}<div className="chart-legend">{typeData.map((item, index) => <span key={item.name}><i style={{ background: palette[index % palette.length] }} />{item.name}: {item.value}</span>)}</div></article>
    </section>

    <section className="report-panel"><div className="panel-title-row"><div><h3>Cleaning audit trail</h3><p>Every transformation applied to the uploaded data</p></div></div><div className="audit-list">{(metrics.transformations_applied || []).map((item, index) => <div key={item}><span>{index + 1}</span><p>{item}</p><b>Applied</b></div>)}</div>{metrics.warnings?.length > 0 && <div className="warning-list"><strong>Quality warnings</strong>{metrics.warnings.map((warning) => <p key={warning}>⚠ {warning}</p>)}</div>}</section>

    <section className="report-panel"><div className="panel-title-row"><div><h3>Column profile</h3><p>Types, completeness, uniqueness, outliers, and representative values</p></div></div><div className="report-table-wrap"><table className="profile-table"><thead><tr><th>Column</th><th>Type</th><th>Missing</th><th>Unique</th><th>Outliers</th><th>Range / sample</th></tr></thead><tbody>{profiles.map((profile) => <tr key={profile.name}><td><strong>{profile.name}</strong></td><td><span className={`type-pill ${profile.inferred_type}`}>{profile.inferred_type}</span></td><td>{profile.missing_count} <small>({profile.missing_percentage}%)</small></td><td>{profile.unique_count}</td><td>{profile.outlier_count || 0}</td><td>{profile.min !== undefined ? `${profile.min} → ${profile.max}` : profile.sample_values?.join(', ') || '—'}</td></tr>)}</tbody></table></div></section>

    <DataTable analysisId={analysis.analysis_id} initialColumns={analysis.columns} initialRows={analysis.preview} />
  </div>
}
