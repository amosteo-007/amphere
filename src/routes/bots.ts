/**
 * Bot profile routes.
 *
 * GET  /api/bots/:name          — Public bot profile (no auth required)
 * PATCH /api/bots/:name         — Update profile (auth required: Bearer token)
 * DELETE /api/bots/:name        — Delete account (auth required)
 */

import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { verifyToken } from '../lib/supabase'

// ─── Auth middleware ───────────────────────────────────────────────────────────

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization ?? ''
  const token = authHeader.replace('Bearer ', '')

  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' })
  }

  const { user, error } = await verifyToken(token)
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  ;(req as any).botId = user.id
  ;(req as any).botEmail = user.email
  next()
}

// ─── GET /api/bots/:name ────────────────────────────────────────────────────────

export async function getBotProfile(req: Request, res: Response) {
  const { name } = req.params

  try {
    const bot = await prisma.bot.findUnique({ where: { name } })
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' })
    }

    // Only expose non-sensitive fields publicly
    return res.json({
      ok: true,
      bot: {
        name: bot.name,
        subscription_tier: bot.subscriptionTier,
        moltbook_handle: bot.moltbookHandle,
        created_at: bot.createdAt.toISOString(),
      },
    })
  } catch (err) {
    console.error('[getBot]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ─── PATCH /api/bots/:name ─────────────────────────────────────────────────────

const updateSchema = z.object({
  moltbook_handle: z.string().max(64).optional(),
  wake_url: z.string().url().max(512).optional(),
})

export async function updateBotProfile(req: Request, res: Response) {
  const { name } = req.params
  const botId = (req as any).botId

  try {
    const bot = await prisma.bot.findUnique({ where: { name } })
    if (!bot) return res.status(404).json({ error: 'Bot not found' })

    // Only the owner can update
    if (bot.id !== botId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    }

    const updated = await prisma.bot.update({
      where: { id: bot.id },
      data: {
        moltbookHandle: parsed.data.moltbook_handle ?? bot.moltbookHandle,
        wakeUrl: parsed.data.wake_url ?? bot.wakeUrl,
      },
    })

    return res.json({
      ok: true,
      bot: {
        name: updated.name,
        email: updated.email,
        subscription_tier: updated.subscriptionTier,
        moltbook_handle: updated.moltbookHandle,
        wake_url: updated.wakeUrl,
        created_at: updated.createdAt.toISOString(),
      },
    })
  } catch (err) {
    console.error('[updateBot]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ─── DELETE /api/bots/:name ────────────────────────────────────────────────────

export async function deleteBot(req: Request, res: Response) {
  const { name } = req.params
  const botId = (req as any).botId

  try {
    const bot = await prisma.bot.findUnique({ where: { name } })
    if (!bot) return res.status(404).json({ error: 'Bot not found' })
    if (bot.id !== botId) return res.status(403).json({ error: 'Forbidden' })

    await prisma.bot.delete({ where: { id: bot.id } })

    return res.json({ ok: true, message: 'Account deleted' })
  } catch (err) {
    console.error('[deleteBot]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
