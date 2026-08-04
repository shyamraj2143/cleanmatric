import React from 'react'

export default function AnalysisWarnings({ warnings = [] }) {
  if (!warnings.length) return null
  return <section className="analysis-warnings" aria-labelledby="warnings-title"><div><span aria-hidden="true">!</span><h2 id="warnings-title">Analysis warnings</h2></div><ul>{warnings.map((warning, index) => <li key={`${typeof warning === 'string' ? warning : warning?.message}-${index}`}>{typeof warning === 'string' ? warning : warning?.message || warning?.detail || 'The backend reported a warning.'}</li>)}</ul></section>
}
