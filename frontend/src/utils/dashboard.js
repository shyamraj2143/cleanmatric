import { getAnalysisPage, normalizeAnalysis } from './analysis'

const unwrap = (payload) => payload?.data ?? payload?.summary ?? payload
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

export function normalizeDashboardSummary(payload) {
  const source = unwrap(payload) || {}
  const metrics = source.metrics || source
  return {
    hasData: Object.keys(source).length > 0,
    total_analyses: number(source.total_analyses ?? source.analysis_count),
    total_records: number(metrics.total_records),
    success_count: number(metrics.success_count ?? metrics.success),
    failed_count: number(metrics.failed_count ?? metrics.failed),
    warning_count: number(metrics.warning_count ?? metrics.warning),
    unknown_count: number(metrics.unknown_count ?? metrics.unknown),
    duplicates_removed: number(metrics.duplicates_removed),
    cleaned_records: number(metrics.cleaned_records),
    invalid_records: number(metrics.invalid_records),
    success_percentage: number(metrics.success_percentage),
    failed_percentage: number(metrics.failed_percentage),
    warning_percentage: number(metrics.warning_percentage),
    unknown_percentage: number(metrics.unknown_percentage),
  }
}

const normalizeItems = (payload, possibleKeys) => {
  const source = unwrap(payload)
  if (Array.isArray(source)) return source
  for (const key of possibleKeys) if (Array.isArray(source?.[key])) return source[key]
  if (source && typeof source === 'object') return Object.entries(source).filter(([, value]) => Number.isFinite(Number(value))).map(([name, value]) => ({ name, value: number(value) }))
  return []
}

export function normalizeDistribution(payload, kind = 'status') {
  const items = normalizeItems(payload, kind === 'status' ? ['status_distribution', 'items', 'distribution'] : ['file_type_distribution', 'items', 'distribution'])
  return items.map((item, index) => ({
    name: String(item?.name ?? item?.label ?? item?.status ?? item?.file_type ?? item?.type ?? `Item ${index + 1}`).toUpperCase(),
    value: number(item?.value ?? item?.count ?? item?.total),
  }))
}

export function normalizeTrends(payload) {
  const items = normalizeItems(payload, ['trends', 'items', 'data_points', 'series'])
  return items.map((item, index) => ({
    name: String(item?.name ?? item?.label ?? item?.date ?? item?.day ?? item?.timestamp ?? index + 1),
    analyses: number(item?.analyses ?? item?.analysis_count ?? item?.count ?? item?.value),
    records: number(item?.records ?? item?.record_count ?? item?.total_records),
  }))
}

export const normalizeRecentAnalyses = (payload) => getAnalysisPage(unwrap(payload) || []).items
export const normalizeLatestAnalysis = (payload) => {
  const source = unwrap(payload)
  return source && Object.keys(source).length ? normalizeAnalysis(source.latest_analysis || source.analysis || source) : null
}
