import React from 'react'

export function LoadingState({ label = 'Loading…', rows = 3 }) {
  return <div className="loading-state" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /><span>{label}</span><div className="skeleton-lines" aria-hidden="true">{Array.from({ length: rows }, (_, index) => <i key={index} />)}</div></div>
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return <div className="state-card error-state" role="alert"><span aria-hidden="true">!</span><div><h2>{title}</h2><p>{message || 'Please try again.'}</p>{onRetry && <button className="secondary-button" type="button" onClick={onRetry}>Try again</button>}</div></div>
}

export function EmptyState({ title, message, action }) {
  return <div className="state-card empty-state"><span aria-hidden="true">◇</span><div><h2>{title}</h2><p>{message}</p>{action}</div></div>
}
