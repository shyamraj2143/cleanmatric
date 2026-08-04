import React, { useState } from 'react'
import DataWorkspace from './DataWorkspace'

const navigation = [
  ['Overview', '▦'],
  ['Analytics', '⌁'],
  ['Reports', '▤'],
  ['Data sources', '◉'],
]

const sourceData = [
  ['Customer database', '8,420', 82, 'purple'],
  ['Website analytics', '5,764', 63, 'blue'],
  ['Mobile application', '4,109', 48, 'green'],
  ['Support tickets', '2,850', 31, 'orange'],
]

function Home({ onSignOut }) {
  const [activeNav, setActiveNav] = useState('Overview')
  const [range, setRange] = useState('Last 30 days')
  const user = JSON.parse(localStorage.getItem('metricflow_user') || '{}')
  const firstName = user.name?.split(' ')[0] || 'there'

  return (
    <main className="dashboard-page">
      <aside className="sidebar">
        <div className="dashboard-brand brand"><span className="brand-mark"><i /><i /><i /></span><span>MetricFlow</span></div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map(([label, icon]) => <button key={label} className={activeNav === label ? 'nav-item active' : 'nav-item'} type="button" onClick={() => setActiveNav(label)}><span className="nav-icon">{icon}</span>{label}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" type="button"><span className="nav-icon">⚙</span>Settings</button>
          <div className="profile-card"><span className="avatar">{firstName.slice(0, 2).toUpperCase()}</span><span><strong>{user.name || 'MetricFlow user'}</strong><small>Administrator</small></span><button onClick={onSignOut} type="button" aria-label="Sign out">↪</button></div>
        </div>
      </aside>

      <section className="dashboard-content">
        <header className="dashboard-header">
          <div><p className="eyebrow">WORKSPACE OVERVIEW</p><h1>Good morning, {firstName} <span>✦</span></h1><p>Here is what is happening with your metrics today.</p></div>
          <div className="header-actions"><button className="notification" type="button" aria-label="Notifications">♧<i /></button><button className="date-select" type="button" onClick={() => setRange(range === 'Last 30 days' ? 'Last 7 days' : 'Last 30 days')}>{range} <span>⌄</span></button></div>
        </header>

        {activeNav === 'Data sources' ? <DataWorkspace /> : <>
        <section className="metric-grid" aria-label="Key metrics">
          <article className="stat-card"><span className="stat-icon purple">↗</span><p>Total records</p><strong>24,820</strong><span className="positive">↑ 12.5% <em>vs. last month</em></span></article>
          <article className="stat-card"><span className="stat-icon green">✓</span><p>Success rate</p><strong>84.6%</strong><span className="positive">↑ 4.2% <em>vs. last month</em></span></article>
          <article className="stat-card"><span className="stat-icon orange">⌁</span><p>Processing time</p><strong>1.8<small>s</small></strong><span className="positive">↓ 0.4s <em>vs. last month</em></span></article>
          <article className="stat-card"><span className="stat-icon blue">◉</span><p>Active sources</p><strong>12</strong><span className="neutral">+2 <em>this month</em></span></article>
        </section>

        <section className="dashboard-grid">
          <article className="panel performance-panel"><div className="panel-heading"><div><h2>Performance trend</h2><p>Records processed over time</p></div><button type="button">•••</button></div><div className="chart-legend"><span><i className="legend-purple" />Processed</span><span><i className="legend-gray" />Failed</span></div><div className="trend-chart"><div className="chart-lines"><i /><i /><i /><i /></div><svg viewBox="0 0 650 190" preserveAspectRatio="none" aria-label="Performance trend chart"><defs><linearGradient id="metricflow-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7785fb" stopOpacity=".32" /><stop offset="1" stopColor="#7785fb" stopOpacity="0" /></linearGradient></defs><path d="M0 156 C35 140 48 146 76 126 S119 130 145 105 S189 114 220 86 S270 103 304 72 S348 76 378 60 S423 78 458 47 S506 57 537 32 S590 40 650 9 L650 190 L0 190Z" fill="url(#metricflow-area)" /><path d="M0 156 C35 140 48 146 76 126 S119 130 145 105 S189 114 220 86 S270 103 304 72 S348 76 378 60 S423 78 458 47 S506 57 537 32 S590 40 650 9" fill="none" stroke="#6e7df8" strokeWidth="3" /></svg><div className="chart-labels"><span>May 01</span><span>May 07</span><span>May 14</span><span>May 21</span><span>May 28</span></div></div></article>
          <article className="panel source-panel"><div className="panel-heading"><div><h2>Top sources</h2><p>By processed records</p></div><button type="button" className="view-all">View all →</button></div><div className="source-list">{sourceData.map(([name, count, progress, tone]) => <div className="source-row" key={name}><div><span className={`source-dot ${tone}`} />{name}<strong>{count}</strong></div><span className="source-bar"><i className={tone} style={{ width: `${progress}%` }} /></span></div>)}</div></article>
          <article className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Latest updates from your workspace</p></div><button type="button" className="view-all">View all →</button></div><div className="activity-list"><div><span className="activity-icon upload">↑</span><p><strong>New data source connected</strong><br />Customer database <time>12 min ago</time></p></div><div><span className="activity-icon report">▤</span><p><strong>Monthly report generated</strong><br />Performance report for April <time>2 hours ago</time></p></div><div><span className="activity-icon check">✓</span><p><strong>Data processing completed</strong><br />Website analytics <time>5 hours ago</time></p></div></div></article>
          <article className="panel insight-panel"><div><span className="insight-symbol">✦</span><p className="eyebrow">METRICFLOW INSIGHT</p><h2>Performance is<br />trending up.</h2><p>Your success rate has increased by <strong>4.2%</strong> compared to last month.</p><button type="button">View insights →</button></div></article>
        </section>
        </>}
      </section>
    </main>
  )
}

export default Home
