import React from 'react'

export const settingsSections = [
  ['profile', 'Profile', 'User'],
  ['appearance', 'Appearance', 'Theme'],
  ['notifications', 'Notifications', 'Alerts'],
  ['data-export', 'Data and Export', 'Files'],
  ['security', 'Security', 'Password'],
]

export default function SettingsLayout({ active, onChange, children }) {
  return <div className="settings-layout"><nav className="settings-nav" aria-label="Settings sections">{settingsSections.map(([id, label, helper]) => <button key={id} type="button" className={active === id ? 'active' : ''} onClick={() => onChange(id)} aria-current={active === id ? 'page' : undefined}><span>{label}</span><small>{helper}</small></button>)}</nav><section className="settings-content">{children}</section></div>
}
