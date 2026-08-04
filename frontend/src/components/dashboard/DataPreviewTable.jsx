import React, { useMemo, useState } from 'react'
import { EmptyState } from './States'

const renderValue = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function DataPreviewTable({ columns = [], rows = [] }) {
  const [query, setQuery] = useState('')
  const safeColumns = columns.length ? columns : [...new Set(rows.flatMap((row) => row && typeof row === 'object' ? Object.keys(row) : []))]
  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) => safeColumns.some((column) => renderValue(row?.[column]).toLowerCase().includes(term)))
  }, [query, rows, safeColumns.join('|')])

  return <article className="panel preview-panel"><div className="preview-heading"><div><h2>Cleaned data preview</h2><p>{rows.length} preview row{rows.length === 1 ? '' : 's'} returned by the backend. Exports may contain more records.</p></div>{rows.length > 0 && <label className="preview-search"><span className="visually-hidden">Search current preview</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search preview" /></label>}</div>
    {!rows.length || !safeColumns.length ? <EmptyState title="No preview available" message="The backend did not return cleaned preview records." /> : <><div className="table-wrap preview-table-wrap"><table><thead><tr>{safeColumns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{filteredRows.map((row, rowIndex) => <tr key={row?.id ?? rowIndex}>{safeColumns.map((column) => <td key={column}>{renderValue(row?.[column])}</td>)}</tr>)}</tbody></table></div>{!filteredRows.length && <p className="no-search-results">No preview rows match “{query}”.</p>}<p className="preview-count">Showing {filteredRows.length} of {rows.length} preview rows.</p></>}
  </article>
}
