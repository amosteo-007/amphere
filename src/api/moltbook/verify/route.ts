// POST /api/moltbook/verify
// Verifies Moltbook handle/identity for Vertical 3 registration

import { NextRequest, NextResponse } from 'next/server';

// Moltbook API configuration
const MOLTBOOK_API_URL = process.env.MOLTBOOK_API_URL || 'https://api.moltbook.com';
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;

// In-memory cache for verified handles (TTL: 24 hours)
const verifiedCache = new Map<string, { handle: string; verified: boolean; expiresAt: number }>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { moltbook_handle } = body;

    // Validation
    if (!moltbook_handle) {
      return NextResponse.json(
        { success: false, message: 'Moltbook handle is required' },
        { status: 400 }
      );
    }

    // Handle format validation
    const handleRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!handleRegex.test(moltbook_handle)) {
      return NextResponse.json(
        { success: false, message: 'Invalid Moltbook handle format' },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = verifiedCache.get(moltbook_handle.toLowerCase());
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json({
        success: cached.verified,
        handle: cached.handle,
        message: cached.verified ? 'Handle verified (cached)' : 'Handle not found'
      });
    }

    // Call Moltbook API to verify handle
    // TODO: Replace with actual Moltbook API endpoint
    const verificationResponse = await fetch(`${MOLTBOOK_API_URL}/v1/agents/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MOLTBOOK_API_KEY}`
      },
      body: JSON.stringify({ handle: moltbook_handle })
    });

    if (!verificationResponse.ok) {
      if (verificationResponse.status === 404) {
        // Handle not found
        verifiedCache.set(moltbook_handle.toLowerCase(), {
          handle: moltbook_handle,
          verified: false,
          expiresAt: Date.now() + 86400000 // 24 hours
        });

        return NextResponse.json({
          success: false,
          message: 'Moltbook handle not found. Please check your handle or connect your Moltbook account.'
        });
      }

      throw new Error(`Moltbook API error: ${verificationResponse.status}`);
    }

    const verificationData = await verificationResponse.json();

    // Cache successful verification
    verifiedCache.set(moltbook_handle.toLowerCase(), {
      handle: moltbook_handle,
      verified: true,
      expiresAt: Date.now() + 86400000 // 24 hours
    });

    return NextResponse.json({
      success: true,
      handle: moltbook_handle,
      agent_id: verificationData.agent_id,
      agent_name: verificationData.agent_name,
      message: 'Moltbook handle verified successfully'
    });

  } catch (error) {
    console.error('Moltbook verification error:', error);
    return NextResponse.json(
      { success: false, message: 'Unable to verify Moltbook handle. Please try again.' },
      { status: 500 }
    );
  }
}

// GET /api/moltbook/verify?handle=xxx - Check single handle
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const handle = url.searchParams.get('handle');

  if (!handle) {
    return NextResponse.json(
      { success: false, message: 'handle query parameter is required' },
      { status: 400 }
    );
  }

  // Reuse POST logic
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ moltbook_handle: handle })
  });

  return POST(mockRequest);
}
