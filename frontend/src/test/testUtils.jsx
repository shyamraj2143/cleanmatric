import React from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { PreferencesProvider } from '../settings/PreferencesContext'

export function renderApp(ui, { route = '/' } = {}) {
  return render(<MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><PreferencesProvider>{ui}</PreferencesProvider></AuthProvider></MemoryRouter>)
}

export const jsonResponse = (data, options = {}) => new Response(JSON.stringify(data), {
  status: options.status || 200,
  headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
})

export const analysisFixture = {
  analysis_id: 42,
  filename: 'server_logs.csv',
  file_type: 'csv',
  file_size: 24510,
  processing_status: 'completed',
  created_at: '2026-07-20T10:00:00Z',
  metrics: {
    total_records: 100,
    success_count: 60,
    failed_count: 20,
    warning_count: 15,
    unknown_count: 5,
    duplicates_removed: 4,
    invalid_records: 1,
    success_percentage: 60,
    failed_percentage: 20,
    warning_percentage: 15,
    unknown_percentage: 5,
  },
  charts: { status_distribution: [], service_distribution: [], timeline_distribution: [] },
  columns: ['service', 'status'],
  preview: [{ service: 'api', status: 'success' }],
  warnings: ['Duplicate rows were removed.'],
}
