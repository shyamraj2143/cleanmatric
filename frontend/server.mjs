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

const sendConfig = (response, requestMethod) => {
  const body = `window.__METRICFLOW_CONFIG__ = ${JSON.stringify(publicConfig)};`
  response.writeHead(200, {
    'Content-Type': 'text/javascript; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(requestMethod === 'HEAD' ? undefined : body)
}

const sendFile = async (response, filePath, requestMethod) => {
  const content = await readFile(filePath)
  const extension = path.extname(filePath).toLowerCase()
  response.writeHead(200, {
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    'Content-Length': content.length,
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(requestMethod === 'HEAD' ? undefined : content)
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
    if (requestUrl.pathname === '/health') {
      const body = JSON.stringify({ status: 'healthy', service: 'cleanmetric-web' })
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) })
      response.end(request.method === 'HEAD' ? undefined : body)
      return
    }
    if (requestUrl.pathname === '/config.js') {
      sendConfig(response, request.method)
      return
    }

    const decodedPath = decodeURIComponent(requestUrl.pathname)
    const candidatePath = path.resolve(publicDirectory, `.${decodedPath}`)
    let filePath = candidatePath.startsWith(publicDirectory) ? candidatePath : path.join(publicDirectory, 'index.html')

    try {
      const details = await stat(filePath)
      if (details.isDirectory()) filePath = path.join(filePath, 'index.html')
      await sendFile(response, filePath, request.method)
    } catch {
      await sendFile(response, path.join(publicDirectory, 'index.html'), request.method)
    }
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Internal Server Error')
  }
})

server.listen(port, host, () => {
  console.log(`CleanMetric web server listening on http://${host}:${port}`)
})
