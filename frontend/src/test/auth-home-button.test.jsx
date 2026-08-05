import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AuthHomeButton from '../components/AuthHomeButton'

const renderNavigation = (route) => render(
  <MemoryRouter initialEntries={[route]}>
    <AuthHomeButton />
    <Routes>
      <Route path="/" element={<h1>CleanMetric home</h1>} />
      <Route path="/login" element={<h1>Login</h1>} />
      <Route path="/register" element={<h1>Register</h1>} />
      <Route path="/dashboard" element={<h1>Dashboard</h1>} />
    </Routes>
  </MemoryRouter>,
)

describe('authentication home navigation', () => {
  it.each(['/login', '/register'])('returns from %s to the public home page', async (route) => {
    const user = userEvent.setup()
    renderNavigation(route)

    await user.click(screen.getByRole('link', { name: 'Back to CleanMetric home page' }))

    expect(screen.getByRole('heading', { name: 'CleanMetric home' })).toBeInTheDocument()
  })

  it('does not appear outside authentication pages', () => {
    renderNavigation('/dashboard')

    expect(screen.queryByRole('link', { name: 'Back to CleanMetric home page' })).not.toBeInTheDocument()
  })
})
