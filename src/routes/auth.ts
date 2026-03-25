/**
 * Auth routes: signup, verify-email, login
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { createAuthUser, generateApiKey } from '../lib/supabase'
import { sendVerificationEmail, sendApiKeyEmail } from '../lib/email'

const router = Router()
export default router

// ─── Signup ──────────────────────────────────────────────────────────────────

const signupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  bot_name: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-zA-Z0-9_-]+$/, 'letters, numbers, _ and - only'),
})

router.post('/signup', async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
  }

  const { email, password, bot_name } = parsed.data
  const lowerEmail = email.toLowerCase()

  try {
    // Check email uniqueness
    const existingEmail = await prisma.bot.findUnique({ where: { email: lowerEmail } })
    if (existingEmail) {
      return res.status(409).json({ error: 'An account with this email already exists' })
    }

    // Check bot_name uniqueness
    const existingName = await prisma.bot.findUnique({ where: { name: bot_name } })
    if (existingName) {
      return res.status(409).json({ error: 'Bot name already taken' })
    }

    // Create Supabase Auth user — email NOT auto-confirmed
    const { user, error } = await createAuthUser(lowerEmail, password, { bot_name })
    if (error || !user) {
      return res.status(400).json({ error: error ?? 'Failed to create account' })
    }

    // Create pending bot record
    await prisma.bot.create({
      data: {
        id: user.id,
        email: lowerEmail,
        name: bot_name,
        apiKey: `PENDING:${user.id}`,
        subscriptionTier: 'free',
      },
    })

    // Send verification email
    await sendVerificationEmail(lowerEmail, bot_name, user.id)

    return res.status(201).json({
      ok: true,
      message: 'Verification email sent. Please check your inbox.',
    })
  } catch (err) {
    console.error('[signup]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── Verify Email ─────────────────────────────────────────────────────────────

router.get('/verify-email', async (req: Request, res: Response) => {
  const { token, email } = req.query as { token?: string; email?: string }

  if (!token || !email) {
    return res.status(400).json({ error: 'Missing token or email' })
  }

  try {
    // Find pending bot record
    const bot = await prisma.bot.findUnique({ where: { email: decodeURIComponent(email) } })
    if (!bot) {
      return res.status(404).json({ error: 'Account not found' })
    }

    if (!bot.apiKey.startsWith('PENDING:')) {
      return res.status(400).json({ error: 'Email already verified' })
    }

    if (bot.id !== token) {
      return res.status(400).json({ error: 'Invalid verification token' })
    }

    // Generate real API key and update record
    const apiKey = generateApiKey()
    await prisma.bot.update({
      where: { id: bot.id },
      data: { apiKey },
    })

    // Send API key to user
    await sendApiKeyEmail(bot.email, bot.name, apiKey)

    // Redirect to a success page
    return res.redirect(`${process.env.APP_URL ?? 'http://localhost:3001'}/verified?bot=${encodeURIComponent(bot.name)}`)
  } catch (err) {
    console.error('[verify-email]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── Login ─────────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' })
  }

  const { email, password } = parsed.data

  try {
    // Look up bot by email
    const bot = await prisma.bot.findUnique({ where: { email: email.toLowerCase() } })
    if (!bot) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    if (bot.apiKey.startsWith('PENDING:')) {
      return res.status(403).json({ error: 'Email not verified. Check your inbox.' })
    }

    // In production: call Supabase to verify password
    // For now: validate via a simple check (Supabase handles this)
    // We'll do a proper Supabase login below
    const loginRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ email: email.toLowerCase(), password }),
    })

    if (!loginRes.ok) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const tokens = (await loginRes.json()) as { access_token: string; refresh_token: string }

    return res.json({
      ok: true,
      bot: {
        id: bot.id,
        name: bot.name,
        email: bot.email,
        api_key: bot.apiKey,
        subscription_tier: bot.subscriptionTier,
      },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    })
  } catch (err) {
    console.error('[login]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})
