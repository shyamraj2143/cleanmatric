import { getConfigValue } from '../config'
import { storage } from '../utils/storage'

const currentHostname = globalThis.location?.hostname || ''
const isLocalDevelopment = currentHostname === 'localhost' || currentHostname === '127.0.0.1' || currentHostname === ''
const configuredBaseUrl = getConfigValue('VITE_API_BASE_URL', 'VITE_API_URL').replace(/\/$/, '')
const useSameOriginProxy = !isLocalDevelopment && getConfigValue('VITE_USE_API_PROXY').toLowerCase() === 'true'
const publicBaseUrl = configuredBaseUrl || (isLocalDevelopment ? 'http://127.0.0.1:8000' : 'https://amusing-renewal-production.up.railway.app')

export const API_BASE_URL = useSameOriginProxy ? '' : publicBaseUrl

const requestBases = [...new Set(
  isLocalDevelopment
    ? [publicBaseUrl]
    : useSameOriginProxy
      ? ['', publicBaseUrl]
      : [publicBaseUrl],
)]

const buildApiUrl = (baseUrl, path) => baseUrl ? `${baseUrl}${path}` : path

export class ApiError extends Error {
  constructor(message, status = 0, detail = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export const getApiErrorMessage = (detail, fallback = 'Unable to complete your request.') => {
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const messages = detail.map((error) => {
      const field = Array.isArray(error?.loc) ? error.loc.filter((part) => part !== 'body').join(' > ') : ''
      const message = error?.msg || error?.message
      return message ? `${field ? `${field}: ` : ''}${message}` : ''
    }).filter(Boolean)
    return messages.join(' ') || fallback
  }
  if (detail && typeof detail === 'object') return detail.detail || detail.message || detail.error || fallback
  return fallback
}

const parsedResponseCache = new WeakMap()

const parseResponse = (response, responseType) => {
  if (responseType === 'blob') return response.blob()
  if (response.status === 204) return Promise.resolve(null)
  if (parsedResponseCache.has(response)) return parsedResponseCache.get(response)

  const payloadPromise = (async () => {
    const type = response.headers.get('content-type') || ''
    if (type.includes('application/json')) return response.json()
    const text = await response.text()
    if (!text) return null
    try { return JSON.parse(text) } catch { return text }
  })()

  parsedResponseCache.set(response, payloadPromise)
  return payloadPromise
}

const shouldTryNextDestination = (response, hasNextDestination) => {
  if (!hasNextDestination) return false
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('text/html')) return true
  return [404, 502, 503, 504].includes(response.status)
}

export async function apiRequest(path, options = {}) {
  const { auth = true, responseType, headers: suppliedHeaders, ...fetchOptions } = options
  const headers = new Headers(suppliedHeaders || {})
  if (auth) {
    const token = storage.getItem('metricflow_token')
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response = null
  const connectionErrors = []

  for (let index = 0; index < requestBases.length; index += 1) {
    const baseUrl = requestBases[index]
    const destination = baseUrl || 'same-origin proxy'
    try {
      const candidateResponse = await fetch(buildApiUrl(baseUrl, path), { ...fetchOptions, headers })
      const hasNextDestination = index < requestBases.length - 1
      if (shouldTryNextDestination(candidateResponse, hasNextDestination)) {
        connectionErrors.push(`${destination} returned ${candidateResponse.status}`)
        continue
      }
      response = candidateResponse
      break
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      connectionErrors.push(`${destination}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (!response) {
    throw new ApiError(
      'Server unavailable. The frontend could not reach the Railway backend through either the configured route or fallback route.',
      0,
      connectionErrors,
    )
  }

  let payload
  try { payload = await parseResponse(response, responseType) } catch { payload = null }
  if (!response.ok) {
    if (response.status === 401 && auth) window.dispatchEvent(new Event('metricflow:unauthorized'))
    const detail = payload?.detail ?? payload
    throw new ApiError(getApiErrorMessage(detail, `Request failed (${response.status}).`), response.status, detail)
  }
  return { data: payload, response }
}

export const authApi = {
  login: (payload) => apiRequest('/api/auth/login', { method: 'POST', auth: false, body: JSON.stringify(payload) }).then(({ data }) => data),
  register: (payload) => apiRequest('/api/auth/register', { method: 'POST', auth: false, body: JSON.stringify(payload) }).then(({ data }) => data),
  google: (credential) => apiRequest('/api/auth/google', { method: 'POST', auth: false, body: JSON.stringify({ credential }) }).then(({ data }) => data),
}

export const analysisApi = {
  analyzeFile(file, { signal, cleaningConfig = {} } = {}) {
    const body = new FormData()
    body.append('file', file)
    body.append('cleaning_config', JSON.stringify(cleaningConfig))
    return apiRequest('/api/v1/files/analyze', { method: 'POST', body, signal }).then(({ data }) => data)
  },
  getAnalyses(page = 1, pageSize = 10, { signal } = {}) {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    return apiRequest(`/api/v1/analyses?${params}`, { signal }).then(({ data }) => data)
  },
  getAnalysisById(analysisId, { signal } = {}) {
    return apiRequest(`/api/v1/analyses/${encodeURIComponent(analysisId)}`, { signal }).then(({ data }) => data)
  },
  getRecords(analysisId, { page = 1, pageSize = 50, search = '', signal } = {}) {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), search })
    return apiRequest(`/api/v1/analyses/${encodeURIComponent(analysisId)}/records?${params}`, { signal }).then(({ data }) => data)
  },
  deleteAnalysis(analysisId) {
    return apiRequest(`/api/v1/analyses/${encodeURIComponent(analysisId)}`, { method: 'DELETE' }).then(({ data }) => data)
  },
  downloadCsv: (analysisId) => downloadExport(analysisId, 'csv'),
  downloadXlsx: (analysisId) => downloadExport(analysisId, 'xlsx'),
  downloadJson: (analysisId) => downloadExport(analysisId, 'json'),
  downloadPdf: (analysisId) => downloadExport(analysisId, 'pdf'),
  downloadExport,
}

export const dashboardApi = {
  getSummary: ({ signal } = {}) => apiRequest('/api/v1/dashboard/summary', { signal }).then(({ data }) => data),
  getStatusDistribution: ({ signal } = {}) => apiRequest('/api/v1/dashboard/status-distribution', { signal }).then(({ data }) => data),
  getFileTypeDistribution: ({ signal } = {}) => apiRequest('/api/v1/dashboard/file-type-distribution', { signal }).then(({ data }) => data),
  getTrends: (range = '30d', { signal } = {}) => apiRequest(`/api/v1/dashboard/trends?${new URLSearchParams({ range })}`, { signal }).then(({ data }) => data),
  getRecentAnalyses: ({ signal } = {}) => apiRequest('/api/v1/dashboard/recent-analyses', { signal }).then(({ data }) => data),
  getLatestAnalysis: ({ signal } = {}) => apiRequest('/api/v1/dashboard/latest-analysis', { signal }).then(({ data }) => data),
}

export const settingsApi = {
  getProfile: ({ signal } = {}) => apiRequest('/api/v1/profile', { signal }).then(({ data }) => data),
  updateProfile: (payload) => apiRequest('/api/v1/profile', { method: 'PATCH', body: JSON.stringify(payload) }).then(({ data }) => data),
  getSettings: ({ signal } = {}) => apiRequest('/api/v1/settings', { signal }).then(({ data }) => data),
  updateSettings: (payload) => apiRequest('/api/v1/settings', { method: 'PATCH', body: JSON.stringify(payload) }).then(({ data }) => data),
  changePassword: (payload) => apiRequest('/api/v1/profile/change-password', { method: 'POST', body: JSON.stringify(payload) }).then(({ data }) => data),
}

const getDownloadFilename = (header, fallback) => {
  if (!header) return fallback
  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch) {
    try { return decodeURIComponent(utfMatch[1]) } catch { return utfMatch[1] }
  }
  const match = header.match(/filename="?([^";]+)"?/i)
  return match?.[1] || fallback
}

async function downloadExport(analysisId, format) {
  const { data, response } = await apiRequest(`/api/v1/analyses/${encodeURIComponent(analysisId)}/export/${format}`, { responseType: 'blob' })
  return { blob: data, filename: getDownloadFilename(response.headers.get('content-disposition'), `cleanmetric-analysis-${analysisId}.${format}`) }
}

export function saveBlob({ blob, filename }) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
