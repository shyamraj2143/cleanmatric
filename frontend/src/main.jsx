import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import AppErrorBoundary from './components/AppErrorBoundary'
import { applyInitialTheme, PreferencesProvider } from './settings/PreferencesContext'
import './styles/style.css'
import './styles/responsive.css'
import './styles/advanced.css'

window.__METRICFLOW_BOOTED__ = true

try {
  applyInitialTheme()
} catch (error) {
  console.warn('MetricFlow theme initialization failed; using the browser default.', error)
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('MetricFlow root element was not found.')

createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider><PreferencesProvider><App /></PreferencesProvider></AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
)
