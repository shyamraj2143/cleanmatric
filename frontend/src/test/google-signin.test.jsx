import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { renderApp } from './testUtils'

describe('Google Sign-In integration', () => {
  beforeEach(() => {
    localStorage.clear()
    window.__METRICFLOW_CONFIG__ = {
      VITE_GOOGLE_WEB_CLIENT_ID: 'test-client.apps.googleusercontent.com',
    }
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    delete window.google
    delete window.__METRICFLOW_CONFIG__
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps Google-owned DOM isolated from React during auth-page rerenders', async () => {
    const initialize = vi.fn()
    const renderButton = vi.fn((host) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = 'Continue with Google'
      host.appendChild(button)
    })
    window.google = { accounts: { id: { initialize, renderButton } } }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()

    renderApp(<App />, { route: '/login' })

    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1))
    expect(initialize).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Sign in to CleanMetric' })).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(consoleError).not.toHaveBeenCalled()
  })
})
