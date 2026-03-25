/**
 * Socket.IO Server — Real-time tournament updates
 *
 * Attach to the Next.js custom server.
 * Handles: live tournament watching, bot notifications on turns.
 */

import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'

let io: SocketIOServer | null = null

export function initSocketIO(httpServer: HTTPServer) {
  if (io) return io

  io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/api/socketio',
  })

  io.on('connection', socket => {
    console.log(`[socket] client connected: ${socket.id}`)

    // Join a tournament room for live spectating
    socket.on('join_tournament', tournamentId => {
      socket.join(`tournament:${tournamentId}`)
      console.log(`[socket] ${socket.id} joined tournament:${tournamentId}`)
    })

    socket.on('leave_tournament', tournamentId => {
      socket.leave(`tournament:${tournamentId}`)
    })

    // For bots: register their tournament + turn notifications
    socket.on('register_bot', ({ tournamentId, botId }) => {
      socket.join(`bot:${botId}`)
      console.log(`[socket] bot ${botId} registered for tournament ${tournamentId}`)
    })

    socket.on('disconnect', () => {
      console.log(`[socket] client disconnected: ${socket.id}`)
    })
  })

  // Attach to global for tournament-runner access
  ;(global as any).__socketIO = io

  return io
}

export function getIO() {
  if (!io) throw new Error('Socket.IO not initialized')
  return io
}
