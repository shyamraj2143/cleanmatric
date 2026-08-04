import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AnalysisResult from '../components/dashboard/AnalysisResult'
import { ErrorState, LoadingState } from '../components/dashboard/States'
import { analysisApi } from '../services/api'

const errorTitle = (status) => status === 404 ? 'Analysis not found' : status === 403 ? 'Access denied' : status === 401 ? 'Session expired' : 'Could not load analysis'

export default function AnalysisDetailPage() {
  const { analysisId } = useParams()
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    analysisApi.getAnalysisById(analysisId, { signal: controller.signal }).then(setAnalysis).catch((requestError) => {
      if (requestError?.name !== 'AbortError') setError(requestError)
    }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [analysisId])

  return <div className="dashboard-stack"><div className="detail-nav"><Link to="/dashboard/history">← Back to history</Link></div>{loading ? <LoadingState label="Loading analysis…" rows={5} /> : error ? <ErrorState title={errorTitle(error.status)} message={error.message} /> : <AnalysisResult payload={analysis} />}</div>
}
