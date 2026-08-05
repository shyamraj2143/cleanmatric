import React, { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { analysisApi } from '../services/api'

const formats = ['CSV', 'TSV', 'XLSX', 'JSON', 'TXT', 'LOG']
const defaultOptions = {
  trim_whitespace: true,
  remove_duplicates: true,
  remove_empty_rows: true,
  missing_strategy: 'keep',
  case_normalization: 'none',
  outlier_action: 'flag',
  normalize_dates: true,
}

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`
}

function Toggle({ checked, onChange, label, hint }) {
  return <label className="clean-toggle"><span><strong>{label}</strong><small>{hint}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>
}

export default function UploadPage() {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [options, setOptions] = useState(defaultOptions)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState('Ready')

  const accepted = useMemo(() => '.csv,.tsv,.xlsx,.json,.txt,.log', [])
  const updateOption = (key, value) => setOptions((current) => ({ ...current, [key]: value }))
  const chooseFile = (candidate) => {
    if (!candidate) return
    if (candidate.size > 20 * 1024 * 1024) {
      setError('File is larger than the 20 MB limit.')
      return
    }
    setFile(candidate)
    setResult(null)
    setError('')
    setPhase('Ready')
  }

  const analyze = async () => {
    if (!file || loading) return
    setLoading(true)
    setError('')
    setResult(null)
    setPhase('Reading and validating file')
    try {
      const timer = window.setTimeout(() => setPhase('Cleaning rows and profiling columns'), 500)
      const payload = await analysisApi.analyzeFile(file, { cleaningConfig: options })
      window.clearTimeout(timer)
      setPhase('Analysis complete')
      setResult(payload)
    } catch (requestError) {
      setPhase('Analysis failed')
      setError(requestError instanceof Error ? requestError.message : 'Unable to analyze this file.')
    } finally {
      setLoading(false)
    }
  }

  const metrics = result?.metrics || {}
  return <div className="clean-workspace">
    <section className="clean-hero-panel">
      <div><p className="clean-kicker">DATA CLEANING STUDIO</p><h2>Turn messy files into reliable datasets.</h2><p>Upload, validate, clean, profile, visualize, and export your data with an auditable cleaning summary.</p></div>
      <div className="format-row">{formats.map((format) => <span key={format}>{format}</span>)}<small>Up to 20 MB</small></div>
    </section>

    <section className="clean-grid">
      <article className="clean-card upload-card">
        <div className="clean-card-heading"><span className="step-number">1</span><div><h3>Select dataset</h3><p>Your file is processed only for this analysis.</p></div></div>
        <button
          type="button"
          className={`clean-dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]) }}
        >
          <input ref={inputRef} type="file" accept={accepted} hidden onChange={(event) => chooseFile(event.target.files?.[0])} />
          <span className="drop-icon" aria-hidden="true">⇧</span>
          {file ? <><strong>{file.name}</strong><small>{formatBytes(file.size)} · Click to replace</small></> : <><strong>Drop a dataset here</strong><small>or click to browse from your device</small></>}
        </button>
        <div className={`pipeline-state ${loading ? 'running' : ''}`}><span /><div><strong>{phase}</strong><small>{loading ? 'Keep this page open while the dataset is processed.' : 'Choose cleaning rules, then start analysis.'}</small></div></div>
      </article>

      <article className="clean-card rules-card">
        <div className="clean-card-heading"><span className="step-number">2</span><div><h3>Cleaning recipe</h3><p>Safe defaults are enabled. You control destructive steps.</p></div></div>
        <div className="toggle-list">
          <Toggle checked={options.trim_whitespace} onChange={(value) => updateOption('trim_whitespace', value)} label="Trim whitespace" hint="Remove accidental spaces around values" />
          <Toggle checked={options.remove_duplicates} onChange={(value) => updateOption('remove_duplicates', value)} label="Remove duplicate rows" hint="Keep the first identical record" />
          <Toggle checked={options.remove_empty_rows} onChange={(value) => updateOption('remove_empty_rows', value)} label="Remove empty rows" hint="Delete rows with no usable values" />
          <Toggle checked={options.normalize_dates} onChange={(value) => updateOption('normalize_dates', value)} label="Normalize dates" hint="Convert detected dates to ISO-8601" />
        </div>
        <div className="rule-select-grid">
          <label>Missing values<select value={options.missing_strategy} onChange={(event) => updateOption('missing_strategy', event.target.value)}><option value="keep">Keep as blank</option><option value="drop_rows">Drop incomplete rows</option><option value="fill_mode">Fill with most common</option><option value="fill_zero">Fill with zero</option></select></label>
          <label>Text case<select value={options.case_normalization} onChange={(event) => updateOption('case_normalization', event.target.value)}><option value="none">Preserve original</option><option value="lower">lowercase</option><option value="upper">UPPERCASE</option><option value="title">Title Case</option></select></label>
          <label>Numeric outliers<select value={options.outlier_action} onChange={(event) => updateOption('outlier_action', event.target.value)}><option value="flag">Flag only</option><option value="ignore">Ignore</option><option value="cap">Cap to IQR limits</option><option value="remove">Remove outlier rows</option></select></label>
        </div>
        <button className="clean-primary-button" type="button" disabled={!file || loading} onClick={analyze}>{loading ? 'Processing dataset…' : 'Clean and analyze'}<span>→</span></button>
        {error && <p className="clean-alert error" role="alert">{error}</p>}
      </article>
    </section>

    {result && <section className="result-snapshot">
      <div className="result-title"><div><p className="clean-kicker">ANALYSIS COMPLETE</p><h3>{result.filename}</h3><p>{metrics.transformations_applied?.join(' · ')}</p></div><div className="quality-orb"><strong>{metrics.quality_score ?? 0}</strong><span>Quality</span></div></div>
      <div className="snapshot-metrics">
        <article><span>Rows ready</span><strong>{metrics.cleaned_records ?? 0}</strong><small>from {metrics.original_records ?? 0}</small></article>
        <article><span>Columns</span><strong>{metrics.column_count ?? result.columns?.length ?? 0}</strong><small>profiled automatically</small></article>
        <article><span>Duplicates</span><strong>{metrics.duplicates_removed ?? 0}</strong><small>removed safely</small></article>
        <article><span>Missing cells</span><strong>{metrics.missing_values_count ?? 0}</strong><small>{metrics.completeness_score ?? 0}% complete</small></article>
        <article><span>Outliers</span><strong>{metrics.outliers_detected ?? 0}</strong><small>detected by IQR</small></article>
      </div>
      <div className="result-actions"><Link className="clean-primary-link" to={`/dashboard/analysis/${result.analysis_id}`}>Open full quality report →</Link><Link className="clean-secondary-link" to="/dashboard/history">View analysis history</Link></div>
    </section>}
  </div>
}
