/**
 * Custom Next.js Server with Socket.IO
 *
 * Entry point for both development and production.
 * Run via:  tsx server.ts          (dev)
 *           tsx server.ts          (prod, NODE_ENV=production)
 *
 * Replaces `next dev` / `next start` — those do NOT attach Socket.IO.
 * Socket.IO is required for live tournament period_result events.
 */

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { initSocketIO } from './lib/socket-server'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME ?? 'localhost'
const port = parseInt(process.env.PORT ?? '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '/', true)
    handle(req, res, parsedUrl)
  })

  // Attach Socket.IO to the HTTP server before listening
  initSocketIO(httpServer)

  httpServer.listen(port, () => {
    const mode = dev ? 'development' : 'production'
    console.log(`> Ready on http://${hostname}:${port} [${mode}]`)
    console.log(`> Socket.IO listening at /api/socketio`)
  })
})
