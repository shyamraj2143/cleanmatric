const numberValue = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

export function normalizeAnalysis(payload = {}) {
  const metrics = payload.metrics || {}
  const preview = Array.isArray(payload.preview) ? payload.preview : []
  const suppliedColumns = Array.isArray(payload.columns) ? payload.columns : []
  const columns = suppliedColumns.length ? suppliedColumns.map((column) => typeof column === 'string' ? column : column?.key || column?.name).filter(Boolean) : [...new Set(preview.flatMap((row) => row && typeof row === 'object' ? Object.keys(row) : []))]
  return {
    ...payload,
    analysis_id: payload.analysis_id ?? payload.id,
    filename: payload.filename || 'Untitled analysis',
    file_type: payload.file_type || payload.type || 'unknown',
    file_size: numberValue(payload.file_size),
    processing_status: payload.processing_status || payload.status || 'completed',
    created_at: payload.created_at || payload.analyzed_at || payload.updated_at,
    metrics: {
      original_records: numberValue(metrics.original_records),
      cleaned_records: numberValue(metrics.cleaned_records),
      total_records: numberValue(metrics.total_records),
      success_count: numberValue(metrics.success_count),
      failed_count: numberValue(metrics.failed_count),
      warning_count: numberValue(metrics.warning_count),
      unknown_count: numberValue(metrics.unknown_count),
      duplicates_removed: numberValue(metrics.duplicates_removed),
      empty_rows_removed: numberValue(metrics.empty_rows_removed),
      invalid_records: numberValue(metrics.invalid_records),
      success_percentage: numberValue(metrics.success_percentage),
      failed_percentage: numberValue(metrics.failed_percentage),
      warning_percentage: numberValue(metrics.warning_percentage),
      unknown_percentage: numberValue(metrics.unknown_percentage),
    },
    charts: {
      status_distribution: Array.isArray(payload.charts?.status_distribution) ? payload.charts.status_distribution : [],
      service_distribution: Array.isArray(payload.charts?.service_distribution) ? payload.charts.service_distribution : [],
      timeline_distribution: Array.isArray(payload.charts?.timeline_distribution) ? payload.charts.timeline_distribution : [],
    },
    columns,
    preview,
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
  }
}

export function getAnalysisPage(payload) {
  const items = Array.isArray(payload) ? payload : payload?.items || payload?.analyses || payload?.results || payload?.data || []
  const total = Array.isArray(payload) ? payload.length : Number(payload?.total ?? payload?.count ?? items.length)
  const pageSize = Number(payload?.page_size ?? payload?.limit ?? items.length)
  return { items: items.map(normalizeAnalysis), total, pageSize }
}

export const formatNumber = (value) => new Intl.NumberFormat().format(numberValue(value))

export function formatBytes(bytes) {
  const value = numberValue(bytes)
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`
}

export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
