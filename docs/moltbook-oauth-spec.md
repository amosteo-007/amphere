# Moltbook OAuth Authentication — Technical Specification

**Version:** 1.0  
**Date:** 2026-03-25  
**Status:** Ready for implementation

---

## Overview

Users log in to Aurasct via their Moltbook account. OAuth flow verifies:
1. User owns a Moltbook agent
2. User has a valid Moltbook account in good standing

---

## OAuth Flow

### Step 1: Redirect to Moltbook Authorization

```
GET https://www.moltbook.com/oauth/authorize
  ?client_id={MOLTBOOK_CLIENT_ID}
  &redirect_uri=https://aurasct0808.vercel.app/api/auth/moltbook/callback
  &response_type=code
  &scope=agent:read+profile:read
  &state={random_state}
```

### Step 2: User Approves (or Denies)

Moltbook redirects to callback with code or error.

**Success:**
```
GET https://aurasct0808.vercel.app/api/auth/moltbook/callback
  ?code={authorization_code}
  &state={random_state}
```

**Error:**
```
GET https://aurasct0808.vercel.app/api/auth/moltbook/callback
  ?error=access_denied
  &error_description=User+denied+access
  &state={random_state}
```

### Step 3: Exchange Code for Token

```typescript
// POST https://www.moltbook.com/oauth/token
{
  "grant_type": "authorization_code",
  "code": "{authorization_code}",
  "client_id": "{MOLTBOOK_CLIENT_ID}",
  "client_secret": "{MOLTBOOK_CLIENT_SECRET}",
  "redirect_uri": "https://aurasct0808.vercel.app/api/auth/moltbook/callback"
}
```

**Response:**
```json
{
  "access_token": "moltbook_sk_...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "refresh_token": "moltbook_rt_...",
  "scope": "agent:read profile:read"
}
```

### Step 4: Fetch User's Agent

```typescript
// GET https://www.moltbook.com/api/v1/agents/me
Headers: Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "id": "agent_id",
  "name": "charge_007",
  "description": "...",
  "is_claimed": true,
  "is_active": true
}
```

### Step 5: Create/Update Aurasct Session

On successful OAuth, create a session for the user:
- Link Moltbook agent ID to Aurasct user
- Store access token (encrypted)
- Set session cookie

---

## API Endpoints

### `GET /api/auth/moltbook`

Initiates OAuth flow. Redirects user to Moltbook.

### `GET /api/auth/moltbook/callback`

Handles Moltbook callback. Exchanges code for token, verifies agent, creates session.

**Query params:**
- `code` — authorization code
- `state` — CSRF protection
- `error` — if denied

**Response (success):** Redirect to `/dashboard`  
**Response (error):** Redirect to `/login?error={error}`

### `POST /api/auth/logout`

Clears session. Optional: revokes Moltbook token.

### `GET /api/auth/me`

Returns current authenticated user.

**Response:**
```json
{
  "user_id": "...",
  "moltbook_agent_id": "...",
  "moltbook_handle": "charge_007",
  "is_beta_tester": true
}
```

---

## Session Management

### JWT Structure

```typescript
{
  "user_id": "uuid",
  "moltbook_agent_id": "...",
  "moltbook_handle": "charge_007",
  "email": null,  // Not provided by Moltbook OAuth
  "is_beta_tester": true,
  "iat": 174...,  // issued at
  "exp": 174...   // 7 days
}
```

### Session Cookie

```
Name: aurasct_session
HttpOnly: true
Secure: true (production)
SameSite: Lax
Max-Age: 604800 (7 days)
```

---

## Security

### CSRF Protection
- Generate random `state` on `/api/auth/moltbook`
- Verify `state` matches on callback
- Store state in session or compare against signed cookie

### Token Storage
- Store Moltbook tokens encrypted at rest
- Access tokens valid 24h
- Use refresh tokens to extend sessions

### Rate Limiting
- OAuth initiation: 10/minute/IP
- Token exchange: 20/minute/IP
- Callback errors: 5/minute/IP

---

## Moltbook API Requirements

**Required from Moltbook:**
1. `MOLTBOOK_CLIENT_ID` — OAuth app client ID
2. `MOLTBOOK_CLIENT_SECRET` — OAuth app client secret
3. `https://www.moltbook.com/oauth/authorize` — authorization endpoint
4. `https://www.moltbook.com/oauth/token` — token endpoint
5. `agent:read` scope — access to agent profile
6. `profile:read` scope — access to user profile

**OAuth scopes needed:**
- `agent:read` — required (verify agent ownership)
- `profile:read` — optional (user profile)

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/app/api/auth/moltbook/route.ts` | OAuth initiation |
| `src/app/api/auth/moltbook/callback/route.ts` | OAuth callback |
| `src/app/api/auth/logout/route.ts` | Logout |
| `src/app/api/auth/me/route.ts` | Current user |
| `src/lib/auth.ts` | JWT/sign/verify helpers |
| `src/lib/moltbook-oauth.ts` | Moltbook API client |
| `src/middleware.ts` | Session validation |

---

## Environment Variables

```env
MOLTBOOK_CLIENT_ID=your_client_id
MOLTBOOK_CLIENT_SECRET=your_client_secret
MOLTBOOK_OAUTH_URL=https://www.moltbook.com
JWT_SECRET=random_256_bit_secret
```

---

## Blockers

1. **Moltbook OAuth not publicly available** — need to request from Moltbook team
2. **Vercel deployment access** — need exec + deploy permissions
3. **No existing OAuth app on Moltbook** — need to register one

---

## Fallback (if OAuth unavailable)

If Moltbook OAuth is not available, use manual agent verification:

1. User enters their Moltbook handle on Aurasct
2. Aurasct generates a unique verification code
3. User pastes code in their Moltbook profile or bio
4. Aurasct verifies the code via Moltbook API

This is less secure but achievable without OAuth.

---

**Status:** Awaiting Moltbook OAuth credentials
**Ready for:** Implementation once credentials received
