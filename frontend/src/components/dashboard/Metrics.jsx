import React from 'react'
import { formatNumber } from '../../utils/analysis'

const metricDefinitions = [
  ['total_records', 'Total Records', 'records', '∑', null],
  ['success_count', 'Success', 'success', '✓', 'success_percentage'],
  ['failed_count', 'Failed', 'failed', '×', 'failed_percentage'],
  ['warning_count', 'Warning', 'warning', '!', 'warning_percentage'],
  ['unknown_count', 'Unknown', 'unknown', '?', 'unknown_percentage'],
  ['duplicates_removed', 'Duplicates Removed', 'duplicates', '≡', null],
  ['invalid_records', 'Invalid Records', 'invalid', '⊘', null],
]

export function MetricCard({ label, count, percentage, tone, icon }) {
  return <article className={`analysis-metric-card ${tone}`}><span className="analysis-metric-icon" aria-hidden="true">{icon}</span><div><p>{label}</p><strong>{formatNumber(count)}</strong>{percentage !== null && percentage !== undefined && <small>{Number(percentage).toFixed(1)}% of cleaned records</small>}</div></article>
}

export function MetricsGrid({ metrics }) {
  return <section className="analysis-metrics-grid" aria-label="Analysis metrics">{metricDefinitions.map(([key, label, tone, icon, percentageKey]) => <MetricCard key={key} label={label} count={metrics?.[key] ?? 0} percentage={percentageKey ? metrics?.[percentageKey] ?? 0 : null} tone={tone} icon={icon} />)}</section>
}
