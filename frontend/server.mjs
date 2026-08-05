import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const publicDirectory = path.join(currentDirectory, 'dist')
const port = Number(process.env.PORT || 3000)
const host = '0.0.0.0'
const proxyTimeoutMs = Number(process.env.API_PROXY_TIMEOUT_MS || 120_000)
const maxProxyBodyBytes = Number(process.env.API_PROXY_MAX_BODY_BYTES || 26 * 1024 * 1024)

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const splitTargets = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim().replace(/\/$/, ''))
  .filter(Boolean)

const proxyTargets = [...new Set([
  ...splitTargets(process.env.API_PROXY_TARGET),
  ...splitTargets(process.env.BACKEND_INTERNAL_URL),
  ...splitTargets(process.env.BACKEND_URL),
  'http://amusing-renewal.railway.internal:8080',
  'http://amusing-renewal:8080',
  'https://amusing-renewal-production.up.railway.app',
])]

const publicConfig = {
  VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || '',
  VITE_API_URL: process.env.VITE_API_URL || '',
  VITE_USE_API_PROXY: process.env.VITE_USE_API_PROXY || 'true',
  VITE_GOOGLE_WEB_CLIENT_ID: process.env.VITE_GOOGLE_WEB_CLIENT_ID
    || process.env.GOOGLE_WEB_CLIENT_ID
    || process.env.GOOGLE_CLIENT_ID
    || '776507506876-vjrrc9m5eer82k6digta7ie2phd4l1f8.apps.googleusercontent.com',
}

const commonHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
}

const hopByHopHeaders = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

const sendJson = (response, statusCode, payload, requestMethod = 'GET') => {
  const body = JSON.stringify(payload)
  response.writeHead(statusCode, {
    ...commonHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  response.end(requestMethod === 'HEAD' ? undefined : body)
}

const sendConfig = (response, requestMethod) => {
  const body = `window.__METRICFLOW_CONFIG__ = ${JSON.stringify(publicConfig)};`
  response.writeHead(200, {
    ...commonHeaders,
    'Content-Type': 'text/javascript; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store, max-age=0, must-revalidate',
    Pragma: 'no-cache',
  })
  response.end(requestMethod === 'HEAD' ? undefined : body)
}

const sendFile = async (response, filePath, requestMethod) => {
  const content = await readFile(filePath)
  const extension = path.extname(filePath).toLowerCase()
  const isApplicationShell = path.basename(filePath) === 'index.html'
  const isApplicationBundle = extension === '.js' || extension === '.css'
  response.writeHead(200, {
    ...commonHeaders,
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    'Content-Length': content.length,
    'Cache-Control': isApplicationShell || isApplicationBundle
      ? 'no-store, max-age=0, must-revalidate'
      : 'public, max-age=86400',
    ...(isApplicationShell || isApplicationBundle ? { Pragma: 'no-cache' } : {}),
  })
  response.end(requestMethod === 'HEAD' ? undefined : content)
}

const sendNotFound = (response, requestMethod) => {
  const body = 'Not Found'
  response.writeHead(404, {
    ...commonHeaders,
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  response.end(requestMethod === 'HEAD' ? undefined : body)
}

const readRequestBody = (request) => new Promise((resolve, reject) => {
  if (request.method === 'GET' || request.method === 'HEAD') {
    resolve(undefined)
    return
  }

  const chunks = []
  let size = 0
  request.on('data', (chunk) => {
    size += chunk.length
    if (size > maxProxyBodyBytes) {
      const error = new Error('Request body is too large.')
      error.code = 'PAYLOAD_TOO_LARGE'
      reject(error)
      request.destroy()
      return
    }
    chunks.push(chunk)
  })
  request.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined))
  request.on('error', reject)
})

const buildUpstreamHeaders = (request) => {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    const lowerName = name.toLowerCase()
    if (value == null || hopByHopHeaders.has(lowerName) || lowerName === 'accept-encoding') continue
    headers.set(name, Array.isArray(value) ? value.join(', ') : value)
  }
  if (request.headers.host) headers.set('x-forwarded-host', request.headers.host)
  headers.set('x-forwarded-proto', request.headers['x-forwarded-proto'] || 'https')
  return headers
}

const copyUpstreamHeaders = (upstreamResponse, response) => {
  for (const [name, value] of upstreamResponse.headers.entries()) {
    const lowerName = name.toLowerCase()
    if (hopByHopHeaders.has(lowerName) || lowerName === 'content-encoding') continue
    response.setHeader(name, value)
  }
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
}

const proxyRequest = async (request, response, requestUrl, pathnameOverride = null) => {
  let requestBody
  try {
    requestBody = await readRequestBody(request)
  } catch (error) {
    if (error?.code === 'PAYLOAD_TOO_LARGE') {
      sendJson(response, 413, { detail: 'Uploaded request is too large.' }, request.method)
      return
    }
    console.error('CleanMetric proxy could not read the request body.', error)
    sendJson(response, 400, { detail: 'Unable to read the request body.' }, request.method)
    return
  }

  const upstreamHeaders = buildUpstreamHeaders(request)
  const upstreamPath = pathnameOverride || requestUrl.pathname
  const failures = []

  for (const target of proxyTargets) {
    try {
      const upstreamUrl = new URL(`${upstreamPath}${requestUrl.search}`, `${target}/`)
      const upstreamResponse = await fetch(upstreamUrl, {
        method: request.method,
        headers: upstreamHeaders,
        body: requestBody,
        redirect: 'manual',
        signal: AbortSignal.timeout(proxyTimeoutMs),
      })

      response.statusCode = upstreamResponse.status
      copyUpstreamHeaders(upstreamResponse, response)
      if (request.method === 'HEAD' || !upstreamResponse.body) {
        response.end()
        return
      }
      Readable.fromWeb(upstreamResponse.body).pipe(response)
      return
    } catch (error) {
      failures.push(`${target}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.error('CleanMetric backend proxy failed for every target.', failures)
  sendJson(response, 502, {
    detail: 'The backend is temporarily unreachable. The request was retried through the private and public Railway routes.',
  }, request.method)
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
    if (requestUrl.pathname === '/health') {
      sendJson(response, 200, { status: 'healthy', service: 'cleanmetric-web' }, request.method)
      return
    }
    if (requestUrl.pathname === '/backend-health') {
      await proxyRequest(request, response, requestUrl, '/health')
      return
    }
    if (requestUrl.pathname === '/config.js') {
      sendConfig(response, request.method)
      return
    }
    if (requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/')) {
      await proxyRequest(request, response, requestUrl)
      return
    }

    const decodedPath = decodeURIComponent(requestUrl.pathname)
    const candidatePath = path.resolve(publicDirectory, `.${decodedPath}`)
    const isInsidePublicDirectory = candidatePath === publicDirectory || candidatePath.startsWith(`${publicDirectory}${path.sep}`)
    let filePath = isInsidePublicDirectory ? candidatePath : path.join(publicDirectory, 'index.html')

    try {
      const details = await stat(filePath)
      if (details.isDirectory()) filePath = path.join(filePath, 'index.html')
      await sendFile(response, filePath, request.method)
    } catch {
      if (decodedPath.startsWith('/assets/') || path.extname(decodedPath)) {
        sendNotFound(response, request.method)
        return
      }
      await sendFile(response, path.join(publicDirectory, 'index.html'), request.method)
    }
  } catch (error) {
    console.error('CleanMetric web request failed.', error)
    sendJson(response, 500, { detail: 'Internal Server Error' }, request.method)
  }
})

server.listen(port, host, () => {
  console.log(`CleanMetric web server listening on http://${host}:${port}`)
  console.log(`CleanMetric API proxy targets: ${proxyTargets.join(', ')}`)
})
