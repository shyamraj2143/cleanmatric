import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const features = [
  {
    icon: 'spark',
    title: 'Smart data cleaning',
    text: 'Detect duplicates, missing values, invalid records, inconsistent formats and quality issues before they affect decisions.',
  },
  {
    icon: 'flow',
    title: 'Reliable processing',
    text: 'Run a structured cleaning pipeline with measurable results, warnings and a clear record of every processing step.',
  },
  {
    icon: 'chart',
    title: 'Decision-ready dashboard',
    text: 'Understand data quality through summaries, trends, status distribution, recent analyses and practical visual reports.',
  },
  {
    icon: 'shield',
    title: 'Private workspace',
    text: 'Each user gets an authenticated workspace with isolated history, profile settings and protected analysis results.',
  },
  {
    icon: 'export',
    title: 'Flexible exports',
    text: 'Download processed results in CSV, Excel, JSON and professional PDF formats for reporting or further work.',
  },
  {
    icon: 'history',
    title: 'Persistent history',
    text: 'Return to previous analyses, review quality metrics, reopen cleaned records and download exports whenever needed.',
  },
]

const workflow = [
  ['01', 'Upload your file', 'Choose a CSV, Excel or JSON dataset from your device.'],
  ['02', 'Review cleaning options', 'Select how missing values, duplicates, formatting and outliers should be handled.'],
  ['03', 'Process and inspect', 'CleanMetric runs the pipeline and presents quality metrics, warnings and previews.'],
  ['04', 'Export clean results', 'Download the processed dataset and a detailed report in the format you need.'],
]

const metrics = [
  ['Quality score', '92.4%'],
  ['Records processed', '18,420'],
  ['Duplicates removed', '1,284'],
  ['Issues resolved', '3,906'],
]

function ProductIcon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  if (name === 'spark') return <svg {...common}><path d="m12 3 1.3 4.2L17.5 8.5l-4.2 1.3L12 14l-1.3-4.2-4.2-1.3 4.2-1.3L12 3Z"/><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></svg>
  if (name === 'flow') return <svg {...common}><path d="M5 4v16"/><path d="M5 8h7a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H5"/><path d="m9 5-4 3-4-3"/><path d="m9 13-4 3-4-3"/></svg>
  if (name === 'chart') return <svg {...common}><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19V3"/><path d="M2 19h22"/></svg>
  if (name === 'shield') return <svg {...common}><path d="M12 3 4.5 6v5.5c0 4.5 3 7.8 7.5 9.5 4.5-1.7 7.5-5 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-5"/></svg>
  if (name === 'export') return <svg {...common}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
  return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></svg>
}

function BrandMark() {
  return <span className="landing-brand-mark" aria-hidden="true"><i /><i /><i /></span>
}

function DashboardPreview() {
  return <div className="landing-preview" aria-label="CleanMetric dashboard preview">
    <div className="landing-preview-sidebar">
      <div className="landing-preview-logo"><BrandMark /></div>
      {[0, 1, 2, 3, 4].map((item) => <span key={item} className={item === 0 ? 'active' : ''} />)}
    </div>
    <div className="landing-preview-main">
      <div className="landing-preview-topbar"><span /><span /><span /></div>
      <div className="landing-preview-heading"><div><small>DATA QUALITY OVERVIEW</small><strong>Your workspace is healthy.</strong></div><button type="button">Export report</button></div>
      <div className="landing-preview-metrics">
        {metrics.map(([label, value], index) => <article key={label}><span className={`landing-metric-dot dot-${index}`} /><small>{label}</small><strong>{value}</strong><em>{index === 0 ? '+8.2% this month' : 'Latest analysis'}</em></article>)}
      </div>
      <div className="landing-preview-grid">
        <article className="landing-preview-chart"><div><strong>Data quality trend</strong><span>Last 30 days</span></div><svg viewBox="0 0 420 150" role="img" aria-label="Rising data quality trend"><defs><linearGradient id="landingArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6674f4" stopOpacity=".28"/><stop offset="1" stopColor="#6674f4" stopOpacity="0"/></linearGradient></defs><path d="M10 124 C58 108 72 119 112 91 S171 94 210 67 271 72 309 46 372 48 410 22 L410 145 L10 145 Z" fill="url(#landingArea)"/><path d="M10 124 C58 108 72 119 112 91 S171 94 210 67 271 72 309 46 372 48 410 22" fill="none" stroke="#6674f4" strokeWidth="4" strokeLinecap="round"/></svg></article>
        <article className="landing-preview-status"><div><strong>Cleaning status</strong><span>18,420 rows</span></div><div className="landing-donut"><span>92%</span></div><ul><li><i className="clean" />Cleaned</li><li><i className="warning" />Warnings</li><li><i className="invalid" />Invalid</li></ul></article>
      </div>
    </div>
  </div>
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const closeMenu = () => setMenuOpen(false)

  return <div className="landing-page">
    <a className="landing-skip-link" href="#main-content">Skip to content</a>
    <header className={`landing-header ${scrolled ? 'is-scrolled' : ''}`}>
      <nav className="landing-nav" aria-label="Primary navigation">
        <Link className="landing-brand" to="/" onClick={closeMenu}><BrandMark /><span>CleanMetric</span></Link>
        <button className="landing-menu-button" type="button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label="Toggle navigation"><span /><span /><span /></button>
        <div className={`landing-nav-links ${menuOpen ? 'is-open' : ''}`}>
          <a href="#overview" onClick={closeMenu}>Overview</a>
          <a href="#workflow" onClick={closeMenu}>How it works</a>
          <a href="#features" onClick={closeMenu}>Features</a>
          <a href="#exports" onClick={closeMenu}>Exports</a>
          <a href="#security" onClick={closeMenu}>Reliability</a>
        </div>
        <div className={`landing-nav-actions ${menuOpen ? 'is-open' : ''}`}>
          <Link className="landing-link-button" to={isAuthenticated ? '/dashboard' : '/login'} onClick={closeMenu}>{isAuthenticated ? 'Open dashboard' : 'Sign in'}</Link>
          <Link className="landing-primary-nav-button" to={isAuthenticated ? '/dashboard/upload' : '/register'} onClick={closeMenu}>{isAuthenticated ? 'Upload data' : 'Get started'}<span>→</span></Link>
        </div>
      </nav>
    </header>

    <main id="main-content">
      <section className="landing-hero">
        <div className="landing-orb orb-one" /><div className="landing-orb orb-two" />
        <div className="landing-container landing-hero-grid">
          <div className="landing-hero-copy">
            <div className="landing-badge"><span />Reliable data in. Better decisions out.</div>
            <h1>Turn messy data into <em>clean, trusted insight.</em></h1>
            <p>CleanMetric helps teams upload, clean, process, analyze and export datasets through one secure workspace—without complicated tools or unclear results.</p>
            <div className="landing-hero-actions">
              <Link className="landing-cta-primary" to={isAuthenticated ? '/dashboard/upload' : '/register'}>{isAuthenticated ? 'Start a new analysis' : 'Create free workspace'}<span>→</span></Link>
              <a className="landing-cta-secondary" href="#workflow"><span className="landing-play">▶</span>See how it works</a>
            </div>
            <div className="landing-trust-row"><span><i>✓</i> No complex setup</span><span><i>✓</i> Clear quality metrics</span><span><i>✓</i> Export-ready results</span></div>
          </div>
          <DashboardPreview />
        </div>
      </section>

      <section className="landing-format-strip" aria-label="Supported data formats">
        <div className="landing-container"><p>Built for the files your work already uses</p><div><span>CSV</span><span>XLSX</span><span>JSON</span><span>PDF reports</span><span>Structured datasets</span></div></div>
      </section>

      <section id="overview" className="landing-section landing-overview-section">
        <div className="landing-container">
          <div className="landing-section-heading centered"><span>ONE COMPLETE WORKSPACE</span><h2>Everything required to make data usable.</h2><p>CleanMetric brings data preparation, quality control, reporting and export into one reliable flow, so users can move from raw files to confident decisions faster.</p></div>
          <div className="landing-overview-grid">
            <article><strong>01</strong><h3>Understand the problem</h3><p>See missing values, duplicate records, invalid fields, inconsistent formats and outliers before choosing what to fix.</p></article>
            <article><strong>02</strong><h3>Clean with control</h3><p>Apply practical cleaning rules while preserving visibility into warnings, changes and quality improvements.</p></article>
            <article><strong>03</strong><h3>Use the result anywhere</h3><p>Review insights in the dashboard and export clean records or professional reports for your next workflow.</p></article>
          </div>
        </div>
      </section>

      <section id="workflow" className="landing-section landing-workflow-section">
        <div className="landing-container landing-workflow-layout">
          <div className="landing-section-heading"><span>SIMPLE BY DESIGN</span><h2>From upload to export in four clear steps.</h2><p>The interface guides users through the full process and keeps every important decision visible.</p><Link className="landing-inline-link" to={isAuthenticated ? '/dashboard/upload' : '/register'}>Try the workflow <span>→</span></Link></div>
          <div className="landing-workflow-list">
            {workflow.map(([number, title, text]) => <article key={number}><strong>{number}</strong><div><h3>{title}</h3><p>{text}</p></div></article>)}
          </div>
        </div>
      </section>

      <section id="features" className="landing-section landing-features-section">
        <div className="landing-container">
          <div className="landing-section-heading centered"><span>ADVANCED CAPABILITIES</span><h2>Serious data tools, presented clearly.</h2><p>Every feature is designed to reduce uncertainty and help users understand what happened to their data.</p></div>
          <div className="landing-feature-grid">{features.map((feature) => <article key={feature.title}><div className="landing-feature-icon"><ProductIcon name={feature.icon} /></div><h3>{feature.title}</h3><p>{feature.text}</p><span className="landing-card-arrow">↗</span></article>)}</div>
        </div>
      </section>

      <section id="exports" className="landing-section landing-export-section">
        <div className="landing-container landing-export-grid">
          <div className="landing-export-visual">
            <div className="landing-report-card report-back"><span>JSON</span><strong>Processed records</strong><small>Structured and integration-ready</small></div>
            <div className="landing-report-card report-middle"><span>XLSX</span><strong>Clean workbook</strong><small>Ready for teams and analysis</small></div>
            <div className="landing-report-card report-front"><div><span>PDF</span><em>REPORT</em></div><strong>Data Quality Report</strong><small>Executive summary, quality score, issue breakdown and processing details.</small><div className="landing-report-bars"><i /><i /><i /><i /></div></div>
          </div>
          <div className="landing-section-heading"><span>EXPORT WITHOUT FRICTION</span><h2>Clean data and clear reports, ready to share.</h2><p>Download the processed dataset for continued work, or generate a professional PDF report that explains quality, changes and results.</p><ul className="landing-check-list"><li><i>✓</i> CSV for universal compatibility</li><li><i>✓</i> Excel for business workflows</li><li><i>✓</i> JSON for applications and APIs</li><li><i>✓</i> PDF for review and reporting</li></ul></div>
        </div>
      </section>

      <section id="security" className="landing-section landing-security-section">
        <div className="landing-container landing-security-grid">
          <div className="landing-section-heading"><span>BUILT FOR RELIABILITY</span><h2>Your workspace should remain dependable as your data grows.</h2><p>CleanMetric combines authenticated access, persistent analysis history, clear processing feedback and recovery-aware storage practices for a more dependable experience.</p></div>
          <div className="landing-security-cards"><article><ProductIcon name="shield"/><div><h3>Protected access</h3><p>Authenticated users only see their own workspace, history and results.</p></div></article><article><ProductIcon name="history"/><div><h3>Persistent records</h3><p>Analyses and account data are stored for continued access across sessions.</p></div></article><article><ProductIcon name="flow"/><div><h3>Transparent processing</h3><p>Warnings and quality metrics explain what changed and what needs attention.</p></div></article></div>
        </div>
      </section>

      <section className="landing-cta-section">
        <div className="landing-container landing-final-cta"><div><span>READY TO CLEAN YOUR DATA?</span><h2>Move from raw records to reliable insight.</h2><p>Create a workspace, upload your first dataset and see exactly what CleanMetric can improve.</p></div><Link to={isAuthenticated ? '/dashboard/upload' : '/register'}>{isAuthenticated ? 'Upload a dataset' : 'Start using CleanMetric'}<span>→</span></Link></div>
      </section>
    </main>

    <footer className="landing-footer">
      <div className="landing-container landing-footer-grid"><div><Link className="landing-brand" to="/"><BrandMark /><span>CleanMetric</span></Link><p>Data cleaning, processing, analysis and reporting in one reliable workspace.</p></div><div><strong>Product</strong><a href="#overview">Overview</a><a href="#workflow">How it works</a><a href="#features">Features</a></div><div><strong>Workspace</strong><Link to="/login">Sign in</Link><Link to="/register">Create account</Link><Link to="/dashboard">Dashboard</Link></div><div><strong>Capabilities</strong><a href="#exports">Data exports</a><a href="#security">Reliability</a><a href="#features">Quality analysis</a></div></div>
      <div className="landing-container landing-footer-bottom"><span>© 2026 CleanMetric. All rights reserved.</span><span>Built to make data easier to trust.</span></div>
    </footer>
  </div>
}
