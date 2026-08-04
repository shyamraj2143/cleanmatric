import React from 'react'
import { normalizeAnalysis, formatBytes, formatDate } from '../../utils/analysis'
import { AnalysisCharts } from './AnalysisCharts'
import AnalysisWarnings from './AnalysisWarnings'
import DataPreviewTable from './DataPreviewTable'
import ExportButtons from './ExportButtons'
import { MetricsGrid } from './Metrics'

export default function AnalysisResult({ payload, showFileDetails = true }) {
  const analysis = normalizeAnalysis(payload)
  return <section className="analysis-result" aria-label="Analysis result">
    {showFileDetails && <article className="panel analysis-file-header"><div><p className="eyebrow">ANALYSIS #{analysis.analysis_id ?? '—'}</p><h2>{analysis.filename}</h2><p>{String(analysis.file_type).toUpperCase()} · {formatBytes(analysis.file_size)} · {formatDate(analysis.created_at)}</p></div><span className={`status-badge ${analysis.processing_status}`}>{analysis.processing_status}</span><ExportButtons analysisId={analysis.analysis_id} /></article>}
    <MetricsGrid metrics={analysis.metrics} />
    <AnalysisWarnings warnings={analysis.warnings} />
    <AnalysisCharts charts={analysis.charts} />
    <DataPreviewTable columns={analysis.columns} rows={analysis.preview} />
  </section>
}
