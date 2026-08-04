import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HistoryPage from '../pages/HistoryPage'
import ExportButtons from '../components/dashboard/ExportButtons'
import { analysisFixture, jsonResponse, renderApp } from './testUtils'

describe('history and exports', () => {
  beforeEach(() => {
    localStorage.setItem('metricflow_token', 'test-token')
    vi.stubGlobal('fetch', vi.fn())
  })

  it('loads authenticated analysis history', async () => {
    fetch.mockResolvedValue(jsonResponse({ items: [analysisFixture], total: 1, page_size: 10 }))
    renderApp(<HistoryPage />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading analysis history')
    expect(await screen.findByText('server_logs.csv')).toBeInTheDocument()
    expect(fetch.mock.calls[0][0]).toContain('/api/v1/analyses?page=1&page_size=10')
    expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer test-token')
  })

  it('downloads an authenticated CSV blob using the response filename', async () => {
    const user = userEvent.setup()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-export')
    fetch.mockResolvedValue(new Response(new Blob(['a,b']), { status: 200, headers: { 'Content-Disposition': 'attachment; filename="cleaned.csv"' } }))
    render(<ExportButtons analysisId={42} />)
    await user.click(screen.getByRole('button', { name: 'Download Clean CSV' }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    expect(fetch.mock.calls[0][0]).toContain('/api/v1/analyses/42/export/csv')
    expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer test-token')
    expect(click).toHaveBeenCalled()
  })
})
