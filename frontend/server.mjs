import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const publicDirectory = path.join(currentDirectory, 'dist')
const port = Number(process.env.PORT || 3000)
const host = '0.0.0.0'

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

const publicConfig = {
  VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || 'https://amusing-renewal-production.up.railway.app',
  VITE_API_URL: process.env.VITE_API_URL || '',
  VITE_GOOGLE_WEB_CLIENT_ID: process.env.VITE_GOOGLE_WEB_CLIENT_ID || process.env.GOOGLE_WEB_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '776507506876-vjrrc9m5eer82k6digta7ie2phd4l1f8.apps.googleusercontent.com',
}

const commonHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
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

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
    if (requestUrl.pathname === '/health') {
      const body = JSON.stringify({ status: 'healthy', service: 'cleanmetric-web' })
      response.writeHead(200, {
        ...commonHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
      })
      response.end(request.method === 'HEAD' ? undefined : body)
      return
    }
    if (requestUrl.pathname === '/config.js') {
      sendConfig(response, request.method)
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
    const body = 'Internal Server Error'
    response.writeHead(500, {
      ...commonHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    })
    response.end(body)
  }
})

server.listen(port, host, () => {
  console.log(`CleanMetric web server listening on http://${host}:${port}`)
})
