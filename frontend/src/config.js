const runtimeConfig = globalThis.window?.__METRICFLOW_CONFIG__ || {}

export const getConfigValue = (...names) => {
  for (const name of names) {
    const value = runtimeConfig[name] || import.meta.env[name]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}
