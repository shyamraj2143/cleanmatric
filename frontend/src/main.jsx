import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import AppErrorBoundary from './components/AppErrorBoundary'
import AuthHomeButton from './components/AuthHomeButton'
import { DEFAULT_BACKEND_URL, normalizeApiBaseUrl } from './config'
import { applyInitialTheme, PreferencesProvider } from './settings/PreferencesContext'
import './styles/style.css'
import './styles/landing.css'
import './styles/responsive.css'
import './styles/advanced.css'
import './styles/auth-navigation.css'

async function bootstrapBackendConfig() {
  const currentConfig = window.__METRICFLOW_CONFIG__ || {}
  const configuredBackend = normalizeApiBaseUrl(
    currentConfig.VITE_API_BASE_URL
      || import.meta.env.VITE_API_BASE_URL
      || DEFAULT_BACKEND_URL,
  )
  const useProxy = String(
    currentConfig.VITE_USE_API_PROXY
      ?? import.meta.env.VITE_USE_API_PROXY
      ?? 'false',
  ).toLowerCase() === 'true'

  const endpoints = [...new Set(
    useProxy
      ? ['/api/public/config', `${configuredBackend}/api/public/config`]
      : [`${configuredBackend}/api/public/config`, '/api/public/config'],
  )]

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(7000),
      })
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.includes('application/json')) continue
      const payload = await response.json()
      const googleClientId = String(payload?.google_web_client_id || '').trim()
      window.__METRICFLOW_CONFIG__ = {
        ...currentConfig,
        VITE_API_BASE_URL: configuredBackend,
        VITE_USE_API_PROXY: useProxy ? 'true' : 'false',
        VITE_GOOGLE_WEB_CLIENT_ID: googleClientId,
        GOOGLE_SIGN_IN_ENABLED: Boolean(payload?.google_sign_in_enabled && googleClientId),
      }
      return
    } catch (error) {
      console.warn(`CleanMetric could not load backend config from ${endpoint}.`, error)
    }
  }

  window.__METRICFLOW_CONFIG__ = {
    ...currentConfig,
    VITE_API_BASE_URL: configuredBackend,
    VITE_USE_API_PROXY: useProxy ? 'true' : 'false',
    VITE_GOOGLE_WEB_CLIENT_ID: String(currentConfig.VITE_GOOGLE_WEB_CLIENT_ID || '').trim(),
    GOOGLE_SIGN_IN_ENABLED: false,
  }
}

async function startApplication() {
  await bootstrapBackendConfig()

  window.__METRICFLOW_BOOTED__ = true
  try { sessionStorage.removeItem('metricflow_bundle_recovery') } catch {}

  try {
    applyInitialTheme()
  } catch (error) {
    console.warn('CleanMetric theme initialization failed; using the browser default.', error)
  }

  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('CleanMetric root element was not found.')

  createRoot(rootElement).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthHomeButton />
          <AuthProvider><PreferencesProvider><App /></PreferencesProvider></AuthProvider>
        </BrowserRouter>
      </AppErrorBoundary>
    </React.StrictMode>,
  )
}

startApplication().catch((error) => {
  console.error('CleanMetric startup failed.', error)
  window.__METRICFLOW_BOOTED__ = true
})
