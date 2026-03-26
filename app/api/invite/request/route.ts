import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * POST /api/invite/request
 * Body: { email: string }
 * Sends a verification email (stub — prints token to console in dev).
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    // Check if email already has a pending invite
    const existing = await prisma.inviteCode.findFirst({
      where: { email, status: 'pending' },
    })

    if (existing) {
      return NextResponse.json({
        ok: true,
        message: 'Verification email already sent',
        email,
      })
    }

    // In production: send email via SendGrid/Postmark
    // For now: mark as verified immediately (dev mode)
    const code = generateInviteCode()

    await prisma.inviteCode.create({
      data: {
        code,
        email,
        status: 'verified', // auto-verify in dev
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        verifiedAt: new Date(),
      },
    })

    console.log(`[invite] Generated code for ${email}: ${code}`)

    return NextResponse.json({
      ok: true,
      message: 'Verification email sent',
      email,
      // DEV ONLY — remove in production:
      dev_code: code,
    })
  } catch (err) {
    console.error('[invite/request error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const CITIES = [
  'Alexandria', 'Babylon', 'Carthage', 'Damascus', 'Ephesus',
  'Florence', 'Granada', 'Havana', 'Istanbul', 'Jakarta',
  'Kyoto', 'Lisbon', 'Marrakech', 'Nairobi', 'Oslo',
  'Prague', 'Quito', 'Reykjavik', 'Samarkand', 'Tangier',
  'Utrecht', 'Valencia', 'Warsaw', 'Xian', 'Yokohama',
  'Zurich', 'Athens', 'Bruges', 'Cairo', 'Dublin',
  'Fez', 'Genoa', 'Hanoi', 'Izmir', 'Jaipur',
  'Krakow', 'Lima', 'Mumbai', 'Naples', 'Odessa',
  'Petra', 'Riga', 'Seville', 'Tashkent', 'Ulaanbaatar',
  'Venice', 'Windhoek', 'Yangon', 'Zagreb', 'Aleppo',
]

const SPECIAL = '!@#$%&*?+'

function generateInviteCode(): string {
  // Pick a random city
  const bytes = randomBytes(16)
  const city = CITIES[bytes[0] % CITIES.length]

  // 10 cryptographically random alphanumeric characters
  const alphanumeric = randomBytes(10).toString('base64url').slice(0, 10)

  // 2 random special symbols
  const s1 = SPECIAL[bytes[1] % SPECIAL.length]
  const s2 = SPECIAL[bytes[2] % SPECIAL.length]

  return `${city}-${alphanumeric}${s1}${s2}`
}
