import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_BACKEND_URL, normalizeApiBaseUrl } from '../config'

describe('production API configuration', () => {
  it('rejects localhost API URLs on the production website', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(normalizeApiBaseUrl('http://127.0.0.1:8000', 'cleanmatric.site.je')).toBe(DEFAULT_BACKEND_URL)
    expect(normalizeApiBaseUrl('http://localhost:8000/', 'cleanmatric.site.je')).toBe(DEFAULT_BACKEND_URL)

    warning.mockRestore()
  })

  it('keeps localhost available for local development', () => {
    expect(normalizeApiBaseUrl('http://127.0.0.1:8000', 'localhost')).toBe('http://127.0.0.1:8000')
  })

  it('keeps valid production backend URLs unchanged', () => {
    expect(normalizeApiBaseUrl(DEFAULT_BACKEND_URL, 'cleanmatric.site.je')).toBe(DEFAULT_BACKEND_URL)
  })
})
