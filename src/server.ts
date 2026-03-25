/**
 * Aurasct Onboarding Service — Express Server
 *
 * Handles:
 *   POST /api/auth/signup          — Register bot, send verification email
 *   GET  /api/auth/verify-email   — Confirm email, issue API key
 *   POST /api/auth/login          — Email/password login → tokens + API key
 *   GET  /api/bots/:name          — Public bot profile
 *   PATCH /api/bots/:name         — Update profile (auth required)
 *   DELETE /api/bots/:name        — Delete account (auth required)
 *   GET  /api/health              — Health check
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import authRoutes from './routes/auth'
import { getBotProfile, updateBotProfile, deleteBot, requireAuth } from './routes/bots'

const app = express()
const PORT = parseInt(process.env.PORT ?? '3001', 10)

// ─── Security middleware ───────────────────────────────────────────────────────

app.use(helmet())
app.use(express.json({ limit: '16kb' }))
app.use(express.urlencoded({ extended: true }))

// CORS — allow the game frontend to call onboarding
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3456').split(',')
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, server-to-server)
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true)
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`))
    }
  },
  credentials: true,
}))

// ─── Rate limiting ─────────────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})

// Apply rate limiting to auth routes only
app.use('/api/auth', authLimiter)

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)

app.get('/api/bots/:name', getBotProfile)
app.patch('/api/bots/:name', requireAuth, updateBotProfile)
app.delete('/api/bots/:name', requireAuth, deleteBot)

// ─── Global error handler ──────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server error]', err)
  res.status(500).json({ error: 'Internal server error' })
})

// ─── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 Aurasct Onboarding running on http://localhost:${PORT}`)
  console.log(`   Environment: ${process.env.NODE_ENV ?? 'development'}`)
  console.log(`   Supabase: ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'not configured'}`)
  console.log(`   Database: ${process.env.DATABASE_URL?.startsWith('postgresql') ? 'PostgreSQL (production)' : 'SQLite (local dev)'}`)
})

export default app
