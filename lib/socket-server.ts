/**
 * Socket.IO Server — real-time tournament updates
 *
 * Attached to the HTTP server in server.ts (custom Next.js server).
 * Must be initialized before any requests are handled.
 *
 * Production flow:
 *   server.ts starts → initSocketIO(httpServer) called once
 *   POST /api/play  → startTournament() + emitTournamentCreated()
 *   Runner loop     → emits period_result, tournament_complete per period
 *   Browser client  → join_tournament → receives live events
 *   Bot client      → register_bot    → receives turn_notification
 */

import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'

let io: SocketIOServer | null = null

export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  if (io) return io

  io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/api/socketio',
  })

  io.on('connection', socket => {
    console.log(`[socket] client connected: ${socket.id}`)

    // Join a tournament room for live spectating
    socket.on('join_tournament', (tournamentId: string) => {
      socket.join(`tournament:${tournamentId}`)
      console.log(`[socket] ${socket.id} joined tournament:${tournamentId}`)
    })

    socket.on('leave_tournament', (tournamentId: string) => {
      socket.leave(`tournament:${tournamentId}`)
    })

    // Bot registers to receive turn notifications
    socket.on('register_bot', ({ botId }: { tournamentId: string; botId: string }) => {
      socket.join(`bot:${botId}`)
      console.log(`[socket] bot ${botId} registered for notifications`)
    })

    socket.on('disconnect', () => {
      console.log(`[socket] client disconnected: ${socket.id}`)
    })
  })

  return io
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized — is server.ts running?')
  return io
}

/**
 * Notify all connected clients that a tournament has started.
 * Called from POST /api/play after tournament is saved and runner is started.
 */
export function emitTournamentCreated(tournamentId: string) {
  if (!io) return
  io.emit('tournament:created', { tournamentId })
}
