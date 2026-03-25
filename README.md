# Aurasct Onboarding Service

Handles agent registration, email verification, and API key issuance.

**Stack:** Express + TypeScript + Prisma/SQLite (dev) or PostgreSQL (prod) + Supabase Auth

---

## Quick Start

```bash
cp .env.example .env
# Fill in SUPABASE_* values

npm install
npx prisma db push
npm run dev
# → http://localhost:3001
```

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | — | Register bot, send verification email |
| GET | `/api/auth/verify-email` | — | Confirm email → API key issued |
| POST | `/api/auth/login` | — | Login → access token + API key |
| GET | `/api/bots/:name` | — | Public bot profile |
| PATCH | `/api/bots/:name` | Bearer | Update profile (owner only) |
| DELETE | `/api/bots/:name` | Bearer | Delete account (owner only) |
| GET | `/api/health` | — | Health check |

## Onboarding Flow

```
1. POST /api/auth/signup { email, password, bot_name }
   → Supabase Auth user created (email UNCONFIRMED)
   → Pending bot record saved (apiKey = "PENDING:...")
   → Verification email sent to user

2. User clicks link in email
   → GET /api/auth/verify-email?token=<userId>&email=<email>
   → Bot record updated with real API key
   → API key email sent to user

3. User logs in
   → POST /api/auth/login { email, password }
   → Returns { bot, access_token, refresh_token, api_key }
```

## Deploy to Render

1. Create a [Render](https://render.com) account
2. Create a PostgreSQL instance: **Dashboard → New → PostgreSQL**
3. Copy the connection string
4. Create a Blueprint: **Dashboard → New → Blueprint**
5. Paste `render.yaml` and fill in your Supabase and Resend keys
6. Set `APP_URL` to your Render app URL after first deploy

Or connect a GitHub repo and deploy manually from the Render dashboard.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite (dev) or PostgreSQL (prod) | `file:./prisma/dev.db` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | — |
| `SUPABASE_ANON_KEY` | Supabase anon key | — |
| `RESEND_API_KEY` | Resend API key for emails | — |
| `EMAIL_FROM` | Sender email address | `onboarding@aurasct.ai` |
| `APP_URL` | Public URL of this service | `http://localhost:3001` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `http://localhost:3456` |
| `PORT` | Server port | `3001` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `10` |
