const productionFallbacks = {
  VITE_API_BASE_URL: 'https://amusing-renewal-production.up.railway.app',
  VITE_GOOGLE_WEB_CLIENT_ID: '776507506876-vjrrc9m5eer82k6digta7ie2phd4l1f8.apps.googleusercontent.com',
}

const readRuntimeConfig = () => globalThis.window?.__METRICFLOW_CONFIG__ || {}

export const getConfigValue = (...names) => {
  const runtimeConfig = readRuntimeConfig()
  for (const name of names) {
    const value = runtimeConfig[name] || import.meta.env[name] || productionFallbacks[name]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}
