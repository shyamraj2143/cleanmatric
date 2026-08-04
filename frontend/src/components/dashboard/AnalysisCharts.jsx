import React from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from './States'

const STATUS_COLORS = { success: '#39a978', failed: '#db6175', warning: '#e6a03d', unknown: '#8993a7' }
const DEFAULT_COLORS = ['#6677f4', '#52a6db', '#8b78e8', '#38aa79', '#e6a03d']

const normalizeDistribution = (items, labelKeys, valueKeys) => (Array.isArray(items) ? items.map((item, index) => {
  if (typeof item === 'number') return { name: `Item ${index + 1}`, value: item }
  const nameKey = labelKeys.find((key) => item?.[key] !== undefined)
  const valueKey = valueKeys.find((key) => item?.[key] !== undefined)
  return { ...item, name: String(item?.[nameKey] ?? `Item ${index + 1}`), value: Number(item?.[valueKey] ?? 0) }
}).filter((item) => Number.isFinite(item.value)) : [])

function ChartPanel({ title, description, children, empty, emptyMessage }) {
  return <article className="panel analysis-chart-panel"><div className="panel-heading"><div><h2>{title}</h2><p>{description}</p></div></div>{empty ? <EmptyState title="No chart data" message={emptyMessage} /> : children}</article>
}

export function StatusDistributionChart({ data }) {
  const suppliedData = normalizeDistribution(data, ['name', 'label', 'status'], ['value', 'count', 'total'])
  const chartData = suppliedData.length ? ['Success', 'Failed', 'Warning', 'Unknown'].map((name) => suppliedData.find((item) => item.name.toLowerCase() === name.toLowerCase()) || { name, value: 0 }) : []
  return <ChartPanel title="Status distribution" description="Backend-classified cleaned records" empty={!chartData.length} emptyMessage="Status distribution data was not provided for this analysis.">
    <div className="chart-container" role="img" aria-label="Donut chart showing Success, Failed, Warning, and Unknown record statuses">
      <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius="53%" outerRadius="78%" paddingAngle={2}>{chartData.map((item, index) => <Cell key={`${item.name}-${index}`} fill={STATUS_COLORS[item.name.toLowerCase()] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />)}</Pie><Tooltip formatter={(value) => [value, 'Records']} /><Legend /></PieChart></ResponsiveContainer>
    </div>
  </ChartPanel>
}

export function ServiceDistributionChart({ data }) {
  const chartData = normalizeDistribution(data, ['name', 'label', 'service'], ['value', 'count', 'total'])
  return <ChartPanel title="Service distribution" description="Records grouped by service" empty={!chartData.length} emptyMessage="Service distribution data was not available.">
    <div className="chart-container" role="img" aria-label="Bar chart showing records by service"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 6 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar name="Records" dataKey="value" fill="#6677f4" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
  </ChartPanel>
}

export function TimelineChart({ data }) {
  const chartData = normalizeDistribution(data, ['name', 'label', 'timestamp', 'date', 'time'], ['value', 'count', 'total'])
  return <ChartPanel title="Timeline" description="Record volume over time" empty={!chartData.length} emptyMessage="Timestamp data was unavailable for this analysis.">
    <div className="chart-container timeline" role="img" aria-label="Line chart showing record volume over time"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 10, right: 12, left: -18, bottom: 6 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Line name="Records" type="monotone" dataKey="value" stroke="#6677f4" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div>
  </ChartPanel>
}

export function AnalysisCharts({ charts }) {
  return <section className="analysis-charts-grid"><StatusDistributionChart data={charts?.status_distribution} /><ServiceDistributionChart data={charts?.service_distribution} />{charts?.timeline_distribution?.length > 0 && <div className="timeline-chart-span"><TimelineChart data={charts.timeline_distribution} /></div>}</section>
}
