import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { renderApp, jsonResponse } from './testUtils'

describe('dashboard access and session handling', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('redirects an unauthenticated dashboard request to login', async () => {
    renderApp(<App />, { route: '/dashboard' })
    expect(await screen.findByRole('heading', { name: 'Sign in to MetricFlow' })).toBeInTheDocument()
  })

  it('redirects to login when a protected request returns 401', async () => {
    localStorage.setItem('metricflow_token', 'test-token')
    localStorage.setItem('metricflow_user', JSON.stringify({ name: 'Student' }))
    fetch.mockResolvedValue(jsonResponse({ detail: 'Session expired' }, { status: 401 }))
    renderApp(<App />, { route: '/dashboard/history' })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in to MetricFlow' })).toBeInTheDocument())
    expect(localStorage.getItem('metricflow_token')).toBeNull()
  })
})
