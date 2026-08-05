export const DEFAULT_BACKEND_URL = 'https://amusing-renewal-production.up.railway.app'

const productionFallbacks = {
  VITE_API_BASE_URL: DEFAULT_BACKEND_URL,
  VITE_USE_API_PROXY: 'false',
  VITE_GOOGLE_WEB_CLIENT_ID: '',
}

const loopbackHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

const readRuntimeConfig = () => globalThis.window?.__METRICFLOW_CONFIG__ || {}

export const isLocalHostname = (hostname = globalThis.location?.hostname || '') => {
  const normalized = String(hostname || '').trim().toLowerCase()
  return normalized === '' || loopbackHosts.has(normalized)
}

export const normalizeApiBaseUrl = (
  value,
  hostname = globalThis.location?.hostname || '',
  fallback = DEFAULT_BACKEND_URL,
) => {
  const candidate = String(value || '').trim().replace(/\/$/, '')
  if (!candidate) return isLocalHostname(hostname) ? 'http://127.0.0.1:8000' : fallback

  try {
    const parsed = new URL(candidate)
    if (!isLocalHostname(hostname) && loopbackHosts.has(parsed.hostname.toLowerCase())) {
      console.warn(`CleanMetric ignored production loopback API URL: ${candidate}`)
      return fallback
    }
    return candidate
  } catch {
    console.warn(`CleanMetric ignored invalid API URL: ${candidate}`)
    return isLocalHostname(hostname) ? 'http://127.0.0.1:8000' : fallback
  }
}

export const getConfigValue = (...names) => {
  const runtimeConfig = readRuntimeConfig()
  for (const name of names) {
    const value = runtimeConfig[name] ?? import.meta.env[name] ?? productionFallbacks[name]
    if (typeof value !== 'string' || !value.trim()) continue
    if (name === 'VITE_API_BASE_URL' || name === 'VITE_API_URL') {
      return normalizeApiBaseUrl(value)
    }
    return value.trim()
  }
  return ''
}
