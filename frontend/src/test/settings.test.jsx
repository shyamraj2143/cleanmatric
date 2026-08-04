import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { jsonResponse, renderApp } from './testUtils'

const profile = { full_name: 'Student User', email: 'student@example.com', created_at: '2026-01-02T10:00:00Z' }
const preferences = { theme: 'light', sidebar_mode: 'expanded', email_notifications: true, analysis_completed_notifications: true, export_completed_notifications: false, default_export_format: 'csv', rows_per_page: 10 }

describe('settings page', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('metricflow_token', 'test-token')
    localStorage.setItem('metricflow_user', JSON.stringify({ name: 'Student User', email: 'student@example.com' }))
    document.documentElement.dataset.theme = 'light'
    vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
      const path = String(url)
      if (path.endsWith('/api/v1/profile') && (!options.method || options.method === 'GET')) return Promise.resolve(jsonResponse(profile))
      if (path.endsWith('/api/v1/profile') && options.method === 'PATCH') return Promise.resolve(jsonResponse({ ...profile, full_name: 'Updated Student' }))
      if (path.endsWith('/api/v1/settings') && (!options.method || options.method === 'GET')) return Promise.resolve(jsonResponse(preferences))
      if (path.endsWith('/api/v1/settings') && options.method === 'PATCH') return Promise.resolve(jsonResponse(JSON.parse(options.body)))
      if (path.endsWith('/change-password')) return Promise.resolve(jsonResponse({ message: 'Password changed' }))
      return Promise.resolve(jsonResponse({}))
    }))
  })

  it('loads profile and account information', async () => {
    renderApp(<App />, { route: '/dashboard/settings' })
    expect(await screen.findByDisplayValue('Student User')).toBeInTheDocument()
    expect(screen.getByDisplayValue('student@example.com')).toHaveAttribute('readonly')
  })

  it('updates the full name through the profile API', async () => {
    const user = userEvent.setup()
    renderApp(<App />, { route: '/dashboard/settings' })
    const name = await screen.findByDisplayValue('Student User')
    await user.clear(name); await user.type(name, 'Updated Student')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText('Profile updated successfully.')).toBeInTheDocument()
    expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith('/api/v1/profile') && options.method === 'PATCH')).toBe(true)
  })

  it('applies and persists theme selection', async () => {
    const user = userEvent.setup()
    renderApp(<App />, { route: '/dashboard/settings' })
    await user.click(await screen.findByRole('button', { name: /Appearance/ }))
    await user.click(screen.getByRole('radio', { name: /Dark/ }))
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
    expect(fetch.mock.calls.some(([, options]) => options.method === 'PATCH' && options.body?.includes('"theme":"dark"'))).toBe(true)
  })

  it('updates notification preferences', async () => {
    const user = userEvent.setup()
    renderApp(<App />, { route: '/dashboard/settings' })
    const settingsNavigation = await screen.findByRole('navigation', { name: 'Settings sections' })
    await user.click(within(settingsNavigation).getByRole('button', { name: /Notifications/ }))
    await user.click(screen.getByRole('checkbox', { name: /Email notifications/ }))
    await waitFor(() => expect(fetch.mock.calls.some(([, options]) => options.body?.includes('"email_notifications":false'))).toBe(true))
  })

  it('updates export and history page-size preferences', async () => {
    const user = userEvent.setup()
    renderApp(<App />, { route: '/dashboard/settings' })
    await user.click(await screen.findByRole('button', { name: /Data and Export/ }))
    await user.selectOptions(screen.getByLabelText('Default export format'), 'xlsx')
    await user.selectOptions(screen.getByLabelText('Rows per history page'), '20')
    await user.click(screen.getByRole('button', { name: 'Save preferences' }))
    expect(await screen.findByText('Data and export preferences saved.')).toBeInTheDocument()
    expect(fetch.mock.calls.some(([, options]) => options.body?.includes('"rows_per_page":20'))).toBe(true)
  })

  it('validates password confirmation before sending credentials', async () => {
    const user = userEvent.setup()
    renderApp(<App />, { route: '/dashboard/settings' })
    await user.click(await screen.findByRole('button', { name: /Security/ }))
    await user.type(screen.getByLabelText(/Current password/), 'oldpassword')
    await user.type(screen.getByLabelText(/^New password/), 'newpassword')
    await user.type(screen.getByLabelText(/Confirm new password/), 'different')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByRole('alert')).toHaveTextContent('do not match')
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/change-password'))).toBe(false)
  })
})
