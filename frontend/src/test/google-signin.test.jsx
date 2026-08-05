import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { renderApp } from './testUtils'

describe('Google Sign-In integration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    delete window.google
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
    expect(await screen.findByRole('heading', { name: 'Sign in to MetricFlow' })).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(consoleError).not.toHaveBeenCalled()
  })
})
