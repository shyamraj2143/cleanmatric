import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import DashboardLayout from './components/dashboard/DashboardLayout'
import { getConfigValue } from './config'
import { authApi } from './services/api'

const AnalysisDetailPage = lazy(() => import('./pages/AnalysisDetailPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const UploadPage = lazy(() => import('./pages/UploadPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client'

const EyeIcon = ({ hidden }) => <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.4" />{hidden && <path d="m4 4 16 16" />}</svg>

function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />
}

function AuthPage({ defaultMode = 'login' }) {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [page, setPage] = useState(defaultMode)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const googleButtonRef = useRef(null)
  const googleInitializedRef = useRef(false)
  const [googleStatus, setGoogleStatus] = useState('loading')
  const isLogin = page === 'login'

  useEffect(() => setPage(defaultMode), [defaultMode])

  const destination = location.state?.from?.pathname || '/dashboard'
  const completeAuthentication = useCallback((result) => {
    login(result)
    navigate(destination, { replace: true })
  }, [destination, login, navigate])

  const switchPage = (nextPage) => {
    setPage(nextPage)
    setShowPassword(false)
    setMessage('')
    setMessageType('')
  }

  const handleGoogleCredential = useCallback(async ({ credential }) => {
    setIsSubmitting(true)
    setMessage('')
    try {
      completeAuthentication(await authApi.google(credential))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to connect to the server.')
      setMessageType('error')
    } finally {
      setIsSubmitting(false)
    }
  }, [completeAuthentication])

  useEffect(() => {
    if (isAuthenticated) return undefined

    const clientId = getConfigValue('VITE_GOOGLE_WEB_CLIENT_ID', 'GOOGLE_WEB_CLIENT_ID', 'GOOGLE_CLIENT_ID')
    if (!clientId) {
      setGoogleStatus('missing-config')
      return undefined
    }

    let cancelled = false
    const renderGoogleButton = () => {
      const host = googleButtonRef.current
      if (cancelled || !host || !host.isConnected || !window.google?.accounts?.id) return

      if (!googleInitializedRef.current) {
        window.google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleCredential })
        googleInitializedRef.current = true
      }

      // This host never contains React-rendered children. Google may safely own
      // everything inside it without breaking React's DOM reconciliation.
      host.replaceChildren()
      const availableWidth = host.parentElement?.clientWidth || 438
      window.google.accounts.id.renderButton(host, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: Math.min(438, availableWidth),
      })
      setGoogleStatus('ready')
    }

    const handleScriptError = () => {
      if (cancelled) return
      setGoogleStatus('load-error')
      setMessage('Google sign-in could not be loaded.')
      setMessageType('error')
    }

    if (window.google?.accounts?.id) {
      renderGoogleButton()
      return () => { cancelled = true }
    }

    const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_URL}"]`)
    if (existingScript) {
      existingScript.addEventListener('load', renderGoogleButton, { once: true })
      existingScript.addEventListener('error', handleScriptError, { once: true })
      return () => {
        cancelled = true
        existingScript.removeEventListener('load', renderGoogleButton)
        existingScript.removeEventListener('error', handleScriptError)
      }
    }

    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT_URL
    script.async = true
    script.defer = true
    script.addEventListener('load', renderGoogleButton, { once: true })
    script.addEventListener('error', handleScriptError, { once: true })
    document.head.appendChild(script)

    return () => {
      cancelled = true
      script.removeEventListener('load', renderGoogleButton)
      script.removeEventListener('error', handleScriptError)
    }
  }, [handleGoogleCredential, isAuthenticated])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const payload = { email: formData.get('email'), password: formData.get('password'), ...(!isLogin && { name: formData.get('name') }) }
    setIsSubmitting(true)
    setMessage('')
    setMessageType('')
    try {
      const result = isLogin ? await authApi.login(payload) : await authApi.register(payload)
      completeAuthentication(result)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to connect to the server.')
      setMessageType('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isAuthenticated) return <Navigate to={destination} replace />

  return <main className="auth-page">
    <section className="brand-panel" aria-label="MetricFlow introduction"><div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>MetricFlow</span></div><div className="brand-copy"><p className="eyebrow">ANALYZE WITH CLARITY</p><h1>Make every metric<br />matter.</h1><p>Bring your data into focus and turn the numbers that matter into confident decisions.</p></div><div className="metric-card" aria-hidden="true"><div className="metric-card-top"><span>Performance overview</span><span className="live-dot">Live</span></div><strong>84.6<span>%</span></strong><div className="chart">{[28, 40, 33, 57, 49, 72, 65, 92].map((height) => <span key={height} style={{ height: `${height}%` }} />)}</div></div><p className="panel-footer">© 2026 MetricFlow. All rights reserved.</p></section>
    <section className="form-panel"><div className="mobile-brand brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>MetricFlow</span></div><div className="auth-card">
      <div className="auth-tabs" role="tablist" aria-label="Authentication options"><button className={isLogin ? 'active' : ''} type="button" onClick={() => switchPage('login')} role="tab" aria-selected={isLogin}>Sign in</button><button className={!isLogin ? 'active' : ''} type="button" onClick={() => switchPage('signup')} role="tab" aria-selected={!isLogin}>Create account</button></div>
      <div className="form-heading"><p className="eyebrow">{isLogin ? 'WELCOME BACK' : 'GET STARTED'}</p><h2>{isLogin ? 'Sign in to MetricFlow' : 'Create your account'}</h2><p>{isLogin ? 'Enter your details to access your workspace.' : 'Start turning your metrics into meaningful insight.'}</p></div>
      <form onSubmit={handleSubmit}>{!isLogin && <label>Full name<input type="text" name="name" placeholder="Enter your full name" autoComplete="name" required /></label>}<label>Work email<input type="email" name="email" placeholder="you@company.com" autoComplete="email" required /></label><label>Password<span className="password-field"><input type={showPassword ? 'text' : 'password'} name="password" placeholder={isLogin ? 'Enter your password' : 'Create a password'} autoComplete={isLogin ? 'current-password' : 'new-password'} minLength="8" required /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}><EyeIcon hidden={!showPassword} /></button></span></label>{isLogin ? <div className="form-options"><label className="checkbox-label"><input type="checkbox" name="remember" /><span>Remember me</span></label><button className="text-button" type="button">Forgot password?</button></div> : <label className="checkbox-label terms"><input type="checkbox" required /><span>I agree to the Terms of Service and Privacy Policy.</span></label>}<button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'} <span>→</span></button>{message && <p className={`form-message ${messageType}`} role="status">{message}</p>}</form>
      <div className="divider"><span>or continue with</span></div>
      <div className="google-signin" aria-label="Continue with Google">
        {googleStatus !== 'ready' && <button className="google-fallback-button" type="button" disabled>{googleStatus === 'missing-config' ? 'Google sign-in not configured' : googleStatus === 'load-error' ? 'Google sign-in unavailable' : 'Loading Google sign-in...'}</button>}
        <div ref={googleButtonRef} className="google-button-host" hidden={googleStatus !== 'ready'} />
      </div>
      <p className="switch-copy">{isLogin ? "Don't have an account?" : 'Already have an account?'}<button type="button" className="text-button" onClick={() => switchPage(isLogin ? 'signup' : 'login')}>{isLogin ? 'Create one' : 'Sign in'}</button></p>
    </div></section>
  </main>
}

export default function App() {
  return <Suspense fallback={<div className="route-loading" role="status">Loading workspace…</div>}><Routes><Route path="/" element={<AuthPage />} /><Route path="/login" element={<AuthPage />} /><Route path="/register" element={<AuthPage defaultMode="signup" />} /><Route element={<ProtectedRoute />}><Route path="/dashboard" element={<DashboardLayout />}><Route index element={<DashboardPage />} /><Route path="upload" element={<UploadPage />} /><Route path="history" element={<HistoryPage />} /><Route path="settings" element={<SettingsPage />} /><Route path="analysis/:analysisId" element={<AnalysisDetailPage />} /></Route></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></Suspense>
}
