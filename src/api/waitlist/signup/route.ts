// POST /api/waitlist/signup
// Handles waitlist form submissions for Vertical 3 beta

import { NextRequest, NextResponse } from 'next/server';

// In-memory store (replace with DB in production)
const waitlistEntries = new Map<string, any>();
const emailSet = new Set<string>();
const moltbookHandleSet = new Set<string>();
const ipRateLimit = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, moltbook_handle, agent_name, referral_source } = body;

    // Validation
    if (!email || !moltbook_handle) {
      return NextResponse.json(
        { success: false, message: 'Email and Moltbook handle are required' },
        { status: 400 }
      );
    }

    // Email validation (RFC 5322 basic)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Moltbook handle validation (3-30 chars, alphanumeric + underscore)
    const handleRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!handleRegex.test(moltbook_handle)) {
      return NextResponse.json(
        { success: false, message: 'Moltbook handle must be 3-30 characters, alphanumeric + underscore' },
        { status: 400 }
      );
    }

    // Rate limiting: 5 signups per IP per hour
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitData = ipRateLimit.get(ip);
    const now = Date.now();

    if (rateLimitData && now < rateLimitData.resetAt) {
      if (rateLimitData.count >= 5) {
        return NextResponse.json(
          { success: false, message: 'Too many signups from your connection. Try again in 1 hour.' },
          { status: 429 }
        );
      }
      rateLimitData.count++;
    } else {
      ipRateLimit.set(ip, { count: 1, resetAt: now + 3600000 });
    }

    // Duplicate check: 1 per email, 1 per Moltbook handle
    if (emailSet.has(email)) {
      return NextResponse.json(
        { success: false, message: 'This email is already registered' },
        { status: 409 }
      );
    }

    if (moltbookHandleSet.has(moltbook_handle.toLowerCase())) {
      return NextResponse.json(
        { success: false, message: 'This Moltbook handle is already registered' },
        { status: 409 }
      );
    }

    // Create waitlist entry
    const waitlist_id = `wl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const entry = {
      waitlist_id,
      email: email.toLowerCase(),
      moltbook_handle: moltbook_handle.toLowerCase(),
      agent_name: agent_name || null,
      referral_source: referral_source || 'Other',
      timestamp: new Date().toISOString(),
      ip_address: ip,
      status: 'pending', // pending → invited → redeemed → played
      invite_code: null,
      invited_at: null,
      redeemed_at: null,
      first_run_at: null
    };

    waitlistEntries.set(waitlist_id, entry);
    emailSet.add(email.toLowerCase());
    moltbookHandleSet.add(moltbook_handle.toLowerCase());

    // TODO: Send confirmation email (integrate with Resend/SendGrid)
    // await sendConfirmationEmail(email, waitlist_id);

    return NextResponse.json({
      success: true,
      waitlist_id,
      message: "You're on the list! Check your email for next steps."
    });

  } catch (error) {
    console.error('Waitlist signup error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/waitlist/signup - List all entries (admin only)
export async function GET(request: NextRequest) {
  // TODO: Add auth check for admin access
  const entries = Array.from(waitlistEntries.values());
  return NextResponse.json({
    success: true,
    count: entries.length,
    entries: entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  });
}
