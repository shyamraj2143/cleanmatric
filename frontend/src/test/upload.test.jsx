import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FileUploadZone, { MAX_FILE_SIZE } from '../components/dashboard/FileUploadZone'
import AnalysisResult from '../components/dashboard/AnalysisResult'
import { analysisFixture, jsonResponse } from './testUtils'

describe('file upload and analysis rendering', () => {
  beforeEach(() => {
    localStorage.setItem('metricflow_token', 'test-token')
    vi.stubGlobal('fetch', vi.fn())
  })

  it('accepts a valid file and shows its metadata', async () => {
    const user = userEvent.setup()
    render(<FileUploadZone />)
    await user.upload(screen.getByLabelText(/choose a csv/i), new File(['status\nsuccess'], 'metrics.csv', { type: 'text/csv' }))
    expect(screen.getByText('metrics.csv')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload and analyze' })).toBeEnabled()
  })

  it('rejects unsupported and oversized files before upload', () => {
    const { rerender } = render(<FileUploadZone />)
    const input = screen.getByLabelText(/choose a csv/i)
    fireEvent.change(input, { target: { files: [new File(['x'], 'metrics.pdf')] } })
    expect(screen.getByRole('alert')).toHaveTextContent('Unsupported file')
    rerender(<FileUploadZone key="large" />)
    const large = new File(['x'], 'large.csv', { type: 'text/csv' })
    Object.defineProperty(large, 'size', { value: MAX_FILE_SIZE + 1 })
    fireEvent.change(screen.getByLabelText(/choose a csv/i), { target: { files: [large] } })
    expect(screen.getByRole('alert')).toHaveTextContent('maximum size is 10 MB')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('renders backend metrics after a successful upload', async () => {
    const user = userEvent.setup()
    fetch.mockResolvedValue(jsonResponse(analysisFixture))
    const handleSuccess = vi.fn()
    render(<FileUploadZone onSuccess={handleSuccess} />)
    await user.upload(screen.getByLabelText(/choose a csv/i), new File(['data'], 'metrics.csv', { type: 'text/csv' }))
    await user.click(screen.getByRole('button', { name: 'Upload and analyze' }))
    await waitFor(() => expect(handleSuccess).toHaveBeenCalledWith(analysisFixture))
    expect(screen.getByRole('status')).toHaveTextContent('Analysis completed successfully')
    const request = fetch.mock.calls[0]
    expect(request[0]).toContain('/api/v1/files/analyze')
    expect(request[1].headers.get('Authorization')).toBe('Bearer test-token')
    expect(request[1].headers.has('Content-Type')).toBe(false)
  })

  it('renders backend errors without hiding them', async () => {
    const user = userEvent.setup()
    fetch.mockResolvedValue(jsonResponse({ detail: 'Malformed CSV: row 8 is invalid.' }, { status: 422 }))
    render(<FileUploadZone />)
    await user.upload(screen.getByLabelText(/choose a csv/i), new File(['bad'], 'bad.csv', { type: 'text/csv' }))
    await user.click(screen.getByRole('button', { name: 'Upload and analyze' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Malformed CSV')
  })

  it('shows metrics and empty chart states safely', () => {
    render(<AnalysisResult payload={analysisFixture} />)
    expect(screen.getByText('Total Records')).toBeInTheDocument()
    expect(screen.getByText('60.0% of cleaned records')).toBeInTheDocument()
    expect(screen.getAllByText('No chart data')).toHaveLength(2)
    expect(screen.getByText('Duplicate rows were removed.')).toBeInTheDocument()
  })
})
