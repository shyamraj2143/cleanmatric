import React, { useRef, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL

const getErrorMessage = (detail) => {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((item) => item?.msg).filter(Boolean).join(' ') || 'Unable to process this file.'
  return 'Unable to process this file.'
}

function DataWorkspace() {
  const inputRef = useRef(null)
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const processFile = async (file) => {
    if (!file) return
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setMessage('Select a CSV or TXT file.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    setIsProcessing(true)
    setMessage('')

    try {
      const response = await fetch(`${API_URL}/api/data/process`, { method: 'POST', body: formData })
      const payload = await response.json()
      if (!response.ok) throw new Error(getErrorMessage(payload.detail))
      setResult(payload)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to process this file.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    processFile(event.dataTransfer.files[0])
  }

  return (
    <section className="data-workspace">
      <article className="upload-panel panel">
        <div className="panel-heading"><div><h2>Upload a data file</h2><p>CSV and TXT files are cleaned automatically.</p></div></div>
        <div className="drop-zone" role="button" tabIndex="0" onClick={() => inputRef.current?.click()} onKeyDown={(event) => event.key === 'Enter' && inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
          <span className="upload-symbol">↑</span>
          <strong>{isProcessing ? 'Processing your data…' : 'Drop a file here or browse'}</strong>
          <span>Maximum file size: 5 MB</span>
          <input ref={inputRef} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(event) => processFile(event.target.files?.[0])} />
        </div>
        {message && <p className="upload-message" role="alert">{message}</p>}
      </article>

      {result && <>
        <section className="processing-summary" aria-label="Data cleaning results">
          <article><span>Rows received</span><strong>{result.stats.total_rows}</strong></article>
          <article><span>Clean rows</span><strong>{result.stats.cleaned_rows}</strong></article>
          <article><span>Duplicates removed</span><strong>{result.stats.removed_duplicate_rows}</strong></article>
          <article><span>Blank rows removed</span><strong>{result.stats.removed_blank_rows}</strong></article>
        </section>

        <article className="cleaning-panel panel">
          <div className="panel-heading"><div><h2>Cleaned data preview</h2><p>{result.filename} · {result.columns.length} columns · showing up to 20 rows</p></div><span className="cleaning-badge">Processing complete</span></div>
          <div className="cleaning-details"><span>Trimmed values: <strong>{result.stats.trimmed_values}</strong></span><span>Missing values: <strong>{result.stats.missing_values}</strong></span></div>
          {result.preview.length ? <div className="table-wrap"><table><thead><tr>{result.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{result.preview.map((row, index) => <tr key={index}>{result.columns.map((column) => <td key={column}>{row[column] || <em>Empty</em>}</td>)}</tr>)}</tbody></table></div> : <p className="empty-preview">No valid records remained after cleaning.</p>}
        </article>
      </>}
    </section>
  )
}

export default DataWorkspace
