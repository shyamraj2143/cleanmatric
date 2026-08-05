import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { renderApp } from './testUtils'

describe('public CleanMetric website', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows the project overview before authentication', async () => {
    renderApp(<App />, { route: '/' })

    expect(screen.getByRole('heading', { name: /Turn messy data into/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Everything required to make data usable.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'From upload to export in four clear steps.' })).toBeInTheDocument()
  })

  it('opens the login page only after the sign-in action', async () => {
    const user = userEvent.setup()
    renderApp(<App />, { route: '/' })

    await user.click(screen.getByRole('link', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Sign in to MetricFlow' })).toBeInTheDocument()
  })
})
