/**
 * Supabase client wrapper.
 *
 * Uses the REST API + Service Role key to:
 *   - Create auth users (signup)
 *   - Send email confirmation (resend)
 *   - Verify JWTs (via /auth/v1/token/verify)
 *
 * We keep bot profiles in our own DB (Prisma/SQLite in dev,
 * Supabase PostgreSQL in prod) — NOT in Supabase Auth.
 * The bot.id is synced with auth.users.id.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY = process.env.SUPABASE_ANON_KEY!

interface SupabaseUser {
  id: string
  email: string
  created_at: string
}

interface VerifyResult {
  user: SupabaseUser | null
  error: string | null
}

/**
 * Create a new auth user with email + password.
 * Does NOT auto-confirm — user must click the confirmation link.
 */
export async function createAuthUser(
  email: string,
  password: string,
  metadata: Record<string, string> = {}
): Promise<{ user: SupabaseUser | null; error: string | null }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: false, // user must verify
      user_metadata: metadata,
    }),
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { msg?: string; error?: string }
    return { user: null, error: body.msg ?? body.error ?? 'Failed to create user' }
  }

  const data = (await res.json()) as { id: string; email: string; created_at: string }
  return { user: { id: data.id, email: data.email, created_at: data.created_at }, error: null }
}

/**
 * Generate a bot API key.
 * 32-char hex string — random, unique.
 */
export function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let key = ''
  for (let i = 0; i < 48; i++) {
    key += chars[Math.floor(Math.random() * chars.length)]
  }
  return key
}

/**
 * Verify a JWT issued by Supabase Auth.
 * Returns the user ID if valid, null otherwise.
 */
export async function verifyToken(token: string): Promise<VerifyResult> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, token_type: 'access_token' }),
  })

  if (!res.ok) {
    return { user: null, error: 'Invalid or expired token' }
  }

  const data = (await res.json()) as { id: string; email: string; created_at: string }
  return {
    user: { id: data.id, email: data.email, created_at: data.created_at },
    error: null,
  }
}

/**
 * Get the anon key (exposed to clients).
 */
export function getAnonKey(): string {
  return ANON_KEY
}
