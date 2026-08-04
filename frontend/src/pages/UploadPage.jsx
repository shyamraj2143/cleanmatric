import React, { useState } from 'react'
import AnalysisResult from '../components/dashboard/AnalysisResult'
import FileUploadZone from '../components/dashboard/FileUploadZone'

export default function UploadPage() {
  const [result, setResult] = useState(null)
  return <div className="dashboard-stack"><div className="page-intro"><h2>Upload and analyze</h2><p>Clean a CSV, TXT, or LOG file and review the backend-generated summary.</p></div><FileUploadZone onSuccess={setResult} />{result && <AnalysisResult payload={result} />}</div>
}
