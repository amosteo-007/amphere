/**
 * Custom Next.js Server with Socket.IO
 *
 * Run: node server.js (instead of next start)
 */

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { initSocketIO } = require('./dist/lib/socket-server')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  // Initialize Socket.IO
  initSocketIO(httpServer)

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> Socket.IO ready on http://${hostname}:${port}/api/socketio`)
  })
})
