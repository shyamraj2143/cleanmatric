import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { storage } from '../utils/storage'

const TOKEN_KEY = 'metricflow_token'
const USER_KEY = 'metricflow_user'
const AuthContext = createContext(null)

const readUser = () => {
  try {
    return JSON.parse(storage.getItem(USER_KEY) || 'null')
  } catch {
    storage.removeItem(USER_KEY)
    return null
  }
}

const isTokenExpired = (token) => {
  if (!token) return true
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()
  } catch {
    return false
  }
}

export function AuthProvider({ children }) {
  const initialToken = storage.getItem(TOKEN_KEY)
  const [token, setToken] = useState(() => (isTokenExpired(initialToken) ? null : initialToken))
  const [user, setUser] = useState(() => (isTokenExpired(initialToken) ? null : readUser()))

  const logout = useCallback(() => {
    storage.removeItem(TOKEN_KEY)
    storage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const login = useCallback((result) => {
    const nextToken = result?.token || result?.access_token
    if (!nextToken) throw new Error('The server did not return an access token.')
    const nextUser = result?.user || { email: result?.email, name: result?.name }
    storage.setItem(TOKEN_KEY, nextToken)
    storage.setItem(USER_KEY, JSON.stringify(nextUser || {}))
    setToken(nextToken)
    setUser(nextUser || {})
  }, [])

  const updateUser = useCallback((patch) => {
    setUser((current) => {
      const nextUser = { ...(current || {}), ...patch }
      storage.setItem(USER_KEY, JSON.stringify(nextUser))
      return nextUser
    })
  }, [])

  useEffect(() => {
    if (initialToken && isTokenExpired(initialToken)) logout()
  }, [initialToken, logout])

  useEffect(() => {
    window.addEventListener('metricflow:unauthorized', logout)
    return () => window.removeEventListener('metricflow:unauthorized', logout)
  }, [logout])

  const value = useMemo(() => ({ token, user, isAuthenticated: Boolean(token), login, logout, updateUser }), [login, logout, token, updateUser, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider.')
  return context
}

export { TOKEN_KEY, USER_KEY, isTokenExpired }
