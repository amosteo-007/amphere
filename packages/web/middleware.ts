export const runtime = 'nodejs';

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

// Routes that require authentication
const AUTH_REQUIRED = ['/dashboard', '/practice', '/billing', '/admin', '/play', '/redeem'];
// Routes that should redirect to /dashboard if already authenticated
const AUTH_REDIRECT = ['/login'];

// Dev/test bypass: skip auth + invite checks for specific routes
const DEV_BYPASS = process.env.NODE_ENV === 'development' || process.env.AUTH_BYPASS === 'true';
const DEV_BYPASS_ROUTES = ['/play', '/redeem', '/agents'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // In dev mode, let /play and /redeem through without auth or invite check
  if (DEV_BYPASS && DEV_BYPASS_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next({ request });
  }

  // If Supabase env vars are missing, let requests through (prevents crash on Vercel)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  try {
    // Build a response we can attach cookies to
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const { data: { user } } = await supabase.auth.getUser();

    // Redirect unauthenticated users away from protected routes
    const needsAuth = AUTH_REQUIRED.some((p) => pathname.startsWith(p));
    if (needsAuth && !user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Invite code check for /play (not /redeem — that's where they enter the code)
    if (pathname.startsWith('/play') && user) {
      const { data: redemption } = await supabase
        .from('user_invite_redemptions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!redemption) {
        const redeemUrl = request.nextUrl.clone();
        redeemUrl.pathname = '/redeem';
        return NextResponse.redirect(redeemUrl);
      }
    }

    // Redirect authenticated users away from login page
    const isAuthRoute = AUTH_REDIRECT.some((p) => pathname.startsWith(p));
    if (isAuthRoute && user) {
      const dashUrl = request.nextUrl.clone();
      dashUrl.pathname = '/dashboard';
      return NextResponse.redirect(dashUrl);
    }

    return response;
  } catch (e) {
    // If middleware crashes (e.g. Supabase Edge incompatibility), let request through
    console.error('[middleware] Error:', e);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|SKILL.md|LLM_AGENT_CONTEXT.md|landing.html|api/bot|api/agents|api/auth/send-verification|api/auth/verify-token|api/billing/webhook).*)',
  ],
};
