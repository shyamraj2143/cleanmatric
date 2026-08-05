import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { usePreferences } from '../../settings/PreferencesContext'
import { settingsApi } from '../../services/api'

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦', end: true },
  { to: '/dashboard/upload', label: 'Cleaning Studio', icon: '⇧' },
  { to: '/dashboard/history', label: 'History & Exports', icon: '◷' },
  { to: '/dashboard/settings', label: 'Settings', icon: '⚙' },
]

const pageContent = {
  '/dashboard': ['Quality dashboard', 'Monitor dataset quality, cleaning performance, and export readiness.'],
  '/dashboard/upload': ['Cleaning studio', 'Clean CSV, TSV, XLSX, JSON, TXT, and LOG datasets with controlled rules.'],
  '/dashboard/history': ['History and exports', 'Review previous analyses and export cleaned data as CSV, Excel, JSON, or PDF.'],
  '/dashboard/settings': ['Settings', 'Manage your profile, appearance, notifications, exports, and security.'],
}

const getDisplayName = (user) => user?.name || user?.full_name || user?.email || 'CleanMetric user'
const getInitials = (name) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

export function DashboardSidebar({ open, collapsed, onClose, onToggleCollapse }) {
  const { user, logout } = useAuth()
  const displayName = getDisplayName(user)
  return <>{open && <button className="sidebar-backdrop" type="button" aria-label="Close navigation" onClick={onClose} />}<aside className={`sidebar dashboard-shell-sidebar ${open ? 'mobile-open' : ''} ${collapsed ? 'collapsed' : ''}`}><div className="sidebar-brand-row"><NavLink className="dashboard-brand brand" to="/dashboard" onClick={onClose} aria-label="CleanMetric dashboard"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span className="sidebar-label">CleanMetric</span></NavLink><button className="sidebar-collapse-button" type="button" onClick={onToggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? '›' : '‹'}</button></div><nav className="sidebar-nav" aria-label="Dashboard navigation">{navigation.map(({ to, label, icon, end }) => <NavLink key={to} to={to} end={end} onClick={onClose} aria-label={label} data-tooltip={collapsed ? label : undefined} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><span className="nav-icon" aria-hidden="true">{icon}</span><span className="sidebar-label">{label}</span></NavLink>)}</nav><div className="sidebar-bottom"><div className="profile-card" data-tooltip={collapsed ? displayName : undefined}><span className="avatar" aria-hidden="true">{getInitials(displayName)}</span><span className="sidebar-profile-copy"><strong>{displayName}</strong><small>{user?.email || 'Authenticated user'}</small></span><button onClick={logout} type="button" aria-label="Sign out" data-tooltip={collapsed ? 'Sign out' : undefined}>↪</button></div></div></aside></>
}

export function DashboardHeader({ onMenuClick, search, onSearchChange }) {
  const { user } = useAuth()
  const { preferences, updatePreferences } = usePreferences()
  const location = useLocation()
  const [title, subtitle] = pageContent[location.pathname] || (location.pathname.startsWith('/dashboard/analysis/') ? ['Analysis report', 'Inspect cleaned records, quality metrics, column profiles, warnings, and exports.'] : pageContent['/dashboard'])
  const displayName = getDisplayName(user)
  const dark = document.documentElement.dataset.theme === 'dark'
  const toggleTheme = async () => {
    const previous = preferences.theme
    const next = dark ? 'light' : 'dark'
    updatePreferences({ theme: next })
    try { await settingsApi.updateSettings({ theme: next }) } catch { updatePreferences({ theme: previous }) }
  }
  return <header className="dashboard-header shell-header"><button className="mobile-menu-button" type="button" onClick={onMenuClick} aria-label="Open navigation">☰</button><div className="header-title"><h1>{title}</h1><p>{subtitle}</p></div><div className="header-tools"><label className="dashboard-search"><span aria-hidden="true">⌕</span><span className="visually-hidden">Search analyses</span><input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search datasets" /></label><button className="header-icon-button" type="button" onClick={toggleTheme} aria-label={`Use ${dark ? 'light' : 'dark'} theme`}>{dark ? '☀' : '◐'}</button><div className="header-user" aria-label={`Signed in as ${displayName}`}><span className="avatar" aria-hidden="true">{getInitials(displayName)}</span><span><strong>{displayName}</strong><small>{user?.email || 'Authenticated user'}</small></span></div></div></header>
}

export default function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { preferences, updatePreferences } = usePreferences()
  const collapsed = preferences.sidebar_mode === 'compact'
  const toggleCollapse = () => {
    const sidebar_mode = collapsed ? 'expanded' : 'compact'
    updatePreferences({ sidebar_mode })
    settingsApi.updateSettings({ compact_sidebar: sidebar_mode === 'compact' }).catch(() => {})
  }
  useEffect(() => { const previousTitle = document.title; document.title = 'CleanMetric | Data Quality'; return () => { document.title = previousTitle } }, [])
  const outletContext = useMemo(() => ({ search }), [search])
  return <main className={`dashboard-page dashboard-shell ${collapsed ? 'sidebar-collapsed' : ''}`}><DashboardSidebar open={menuOpen} collapsed={collapsed} onClose={() => setMenuOpen(false)} onToggleCollapse={toggleCollapse} /><section className="dashboard-content dashboard-shell-content"><DashboardHeader onMenuClick={() => setMenuOpen(true)} search={search} onSearchChange={setSearch} /><Outlet context={outletContext} /></section></main>
}
