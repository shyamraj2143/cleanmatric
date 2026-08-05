import React from 'react'

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, details) {
    console.error('MetricFlow frontend crashed', error, details)
  }

  render() {
    if (!this.state.error) return this.props.children

    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f6f7fb', color: '#17213f', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section style={{ width: 'min(560px, 100%)', padding: 32, border: '1px solid #dfe3ef', borderRadius: 18, background: '#fff', boxShadow: '0 18px 50px rgba(31,45,91,.12)', textAlign: 'center' }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, letterSpacing: '.12em', color: '#5d6df6' }}>APPLICATION RECOVERY</p>
        <h1 style={{ margin: '0 0 12px', fontSize: 26 }}>MetricFlow hit a loading problem</h1>
        <p style={{ margin: '0 0 20px', lineHeight: 1.6, color: '#5f6880' }}>The latest frontend bundle could not finish loading. Reload the page to fetch a clean deployment.</p>
        <button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 12, padding: '12px 20px', background: '#5d6df6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Reload application</button>
      </section>
    </main>
  }
}
