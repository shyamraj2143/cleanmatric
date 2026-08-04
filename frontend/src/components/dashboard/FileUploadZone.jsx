import React, { useRef, useState } from 'react'
import { analysisApi } from '../../services/api'
import { formatBytes } from '../../utils/analysis'

export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const ACCEPTED_FILE_PATTERN = /\.(csv|txt|log)$/i

export function validateFile(file) {
  if (!file) return 'Choose a file to continue.'
  if (!ACCEPTED_FILE_PATTERN.test(file.name)) return 'Unsupported file. Choose a CSV, TXT, or LOG file.'
  if (file.size > MAX_FILE_SIZE) return 'File is too large. The maximum size is 10 MB.'
  if (file.size === 0) return 'The selected file is empty.'
  return ''
}

export function SelectedFileCard({ file, onRemove, disabled }) {
  const extension = file.name.split('.').pop()?.toUpperCase() || 'FILE'
  return <div className="selected-file-card"><span className="file-type-icon" aria-hidden="true">{extension}</span><span><strong>{file.name}</strong><small>{extension} · {formatBytes(file.size)}</small></span><button type="button" onClick={onRemove} disabled={disabled}>Remove</button></div>
}

export function UploadProgress({ state }) {
  if (!['uploading', 'processing'].includes(state)) return null
  return <div className="upload-progress" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /><div><strong>Uploading and analyzing file…</strong><span>The backend is cleaning records and preparing your summary.</span></div></div>
}

export default function FileUploadZone({ onSuccess }) {
  const inputRef = useRef(null)
  const requestRef = useRef(null)
  const [file, setFile] = useState(null)
  const [state, setState] = useState('idle')
  const [message, setMessage] = useState('')
  const [dragging, setDragging] = useState(false)
  const busy = state === 'uploading' || state === 'processing'

  const selectFile = (nextFile) => {
    const validationError = validateFile(nextFile)
    setMessage(validationError)
    if (validationError) {
      setFile(null)
      setState('error')
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setFile(nextFile)
    setState('file-selected')
  }

  const removeFile = () => {
    setFile(null)
    setMessage('')
    setState('idle')
    if (inputRef.current) inputRef.current.value = ''
  }

  const submit = async () => {
    const validationError = validateFile(file)
    if (validationError || busy) {
      if (validationError) setMessage(validationError)
      return
    }
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setState('uploading')
    setMessage('')
    try {
      const result = await analysisApi.analyzeFile(file, { signal: controller.signal })
      setState('success')
      setMessage('Analysis completed successfully.')
      onSuccess?.(result)
    } catch (error) {
      if (error?.name === 'AbortError') return
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Unable to analyze this file.')
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    if (!busy) selectFile(event.dataTransfer.files?.[0])
  }

  return (
    <article className="panel upload-panel analysis-upload-panel">
      <div className="panel-heading"><div><h2>Upload metric data</h2><p>Files are validated here and securely analyzed by the backend.</p></div></div>
      {!file && <label className={`drop-zone ${dragging ? 'dragging' : ''} ${busy ? 'disabled' : ''}`} role="button" tabIndex={busy ? -1 : 0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inputRef.current?.click() } }} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
        <span className="upload-symbol" aria-hidden="true">↑</span>
        <strong>Drop a file here or browse</strong>
        <span>CSV, TXT, or LOG · maximum 10 MB</span>
        <input ref={inputRef} type="file" accept=".csv,.txt,.log,text/csv,text/plain" disabled={busy} onChange={(event) => selectFile(event.target.files?.[0])} aria-label="Choose a CSV, TXT, or LOG file" />
      </label>}
      {file && <SelectedFileCard file={file} disabled={busy} onRemove={removeFile} />}
      {file && <div className="upload-actions"><button className="secondary-button" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>Change file</button><input ref={inputRef} className="visually-hidden" type="file" accept=".csv,.txt,.log,text/csv,text/plain" disabled={busy} onChange={(event) => selectFile(event.target.files?.[0])} aria-label="Change selected file" /><button className="primary-action-button" type="button" disabled={busy} onClick={submit}>{busy ? 'Analyzing…' : 'Upload and analyze'}</button></div>}
      <UploadProgress state={state} />
      {message && <p className={`upload-feedback ${state}`} role={state === 'error' ? 'alert' : 'status'} aria-live="polite">{message}</p>}
    </article>
  )
}
