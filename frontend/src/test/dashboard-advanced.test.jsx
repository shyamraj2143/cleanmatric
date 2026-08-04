import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { jsonResponse, renderApp } from './testUtils'

const summary = { total_analyses: 12, total_records: 420, success_count: 300, failed_count: 50, warning_count: 45, unknown_count: 25, duplicates_removed: 8, cleaned_records: 412, invalid_records: 2, success_percentage: 71.4 }
const recent = [{ analysis_id: 7, filename: 'latest.csv', file_type: 'csv', processing_status: 'completed', metrics: { total_records: 10, success_count: 8 }, created_at: '2026-07-20T10:00:00Z' }]

const dashboardResponse = (url) => {
  if (url.includes('/summary')) return jsonResponse(summary)
  if (url.includes('/status-distribution')) return jsonResponse([{ status: 'success', count: 300 }, { status: 'failed', count: 50 }])
  if (url.includes('/file-type-distribution')) return jsonResponse([{ file_type: 'csv', count: 10 }])
  if (url.includes('/trends')) return jsonResponse([{ date: 'Jul 20', analyses: 3, records: 100 }])
  if (url.includes('/recent-analyses')) return jsonResponse(recent)
  if (url.includes('/latest-analysis')) return jsonResponse(recent[0])
  return jsonResponse({})
}

describe('advanced dashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('metricflow_token', 'test-token')
    localStorage.setItem('metricflow_user', JSON.stringify({ name: 'Student', email: 'student@example.com' }))
    vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(dashboardResponse(String(url)))))
  })

  it('renders API summary cards and recent analyses with missing optional fields', async () => {
    renderApp(<App />, { route: '/dashboard' })
    expect(await screen.findByText('Total Analyses', {}, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByText('420')).toBeInTheDocument()
    expect(await screen.findAllByText('latest.csv')).toHaveLength(2)
    expect(screen.getByRole('columnheader', { name: 'Type' })).toBeInTheDocument()
  }, 15000)

  it('renders safe empty states', async () => {
    fetch.mockImplementation((url) => {
      if (String(url).includes('/latest-analysis')) return Promise.resolve(jsonResponse(null))
      if (String(url).includes('/summary')) return Promise.resolve(jsonResponse({}))
      return Promise.resolve(jsonResponse([]))
    })
    renderApp(<App />, { route: '/dashboard' })
    expect(await screen.findByText('No dashboard data')).toBeInTheDocument()
    expect(screen.getAllByText('No analyses yet')).toHaveLength(2)
    expect(screen.getByText('No quality data')).toBeInTheDocument()
  })

  it('requests a new trend range when the selector changes', async () => {
    const user = userEvent.setup()
    renderApp(<App />, { route: '/dashboard' })
    const selector = await screen.findByRole('combobox', { name: 'Trend range' })
    await user.selectOptions(selector, '7d')
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes('/dashboard/trends?range=7d'))).toBe(true))
  })

  it('renders friendly API errors', async () => {
    fetch.mockResolvedValue(jsonResponse({ detail: 'Dashboard service unavailable.' }, { status: 503 }))
    renderApp(<App />, { route: '/dashboard' })
    expect(await screen.findAllByText('Dashboard service unavailable.')).not.toHaveLength(0)
    expect(screen.queryByText(/traceback/i)).not.toBeInTheDocument()
  })

  it('opens and closes the mobile navigation drawer', async () => {
    const user = userEvent.setup()
    renderApp(<App />, { route: '/dashboard/upload' })
    await user.click(await screen.findByRole('button', { name: 'Open navigation' }))
    const close = screen.getByRole('button', { name: 'Close navigation' })
    expect(close).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Dashboard navigation' })).getByText('Settings')).toBeInTheDocument()
    await user.click(close)
    expect(screen.queryByRole('button', { name: 'Close navigation' })).not.toBeInTheDocument()
  })
})
