import React from 'react'
import { Link, useLocation } from 'react-router-dom'

const authPaths = new Set(['/login', '/register'])

export default function AuthHomeButton() {
  const { pathname } = useLocation()

  if (!authPaths.has(pathname)) return null

  return (
    <Link className="auth-home-button" to="/" aria-label="Back to CleanMetric home page">
      <span aria-hidden="true">←</span>
      <span>Back to Home</span>
    </Link>
  )
}
