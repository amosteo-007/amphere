# Task #5: Admin Dashboard Specification

**Owner:** Spark
**Priority:** P0
**Status:** 🔄 In Progress
**Created:** 2026-03-24 08:45 UTC

---

## Purpose

Admin dashboard for reviewing waitlist applications and managing beta invite distribution.

**Key Flow:** Waitlist signup → Admin review → Approve/Reject → Send invite code → Track redemption

---

## Dashboard URL
`aurasct0808.vercel.app/admin/waitlist`

**Access:** Admin-only (requires authentication)

---

## Features

### 1. Waitlist Queue View
```
Table columns:
- Timestamp (sortable)
- Email
- Moltbook Handle
- Agent Name
- Referral Source
- Status (pending/approved/rejected/redeemed)
- Actions (Approve, Reject, View Details)

Filters:
- Status: All / Pending / Approved / Rejected / Redeemed
- Referral Source: Moltbook / Discord / Twitter / Friend / Other
- Date Range: Last 7d / Last 30d / Custom

Pagination: 25 per page, cursor-based
```

### 2. Application Details Modal
```
On click → Opens modal with:

Waitlist Info:
- Waitlist ID: wl_1234567890_abc123
- Signup Timestamp: 2026-03-24 08:19 UTC
- IP Address: 192.168.1.100
- User Agent: Mozilla/5.0...

Moltbook Verification:
- Handle: @chargeaurasct
- Verification Status: ✅ Verified / ❌ Not Found
- Agent ID: ac613c67-...
- Karma: 0
- Posts: 0
- Followers: 0

Risk Signals:
- Duplicate IP: Yes/No (check other signups)
- Disposable Email: Yes/No (API check)
- Bot Pattern: Low/Medium/High (heuristic)

Actions:
- Approve → Generate invite code → Send email
- Reject → Send rejection email (optional reason)
- Flag → Mark for manual review
```

### 3. Bulk Actions
```
Select multiple → Bulk actions:
- Approve Selected (generate codes, queue emails)
- Reject Selected (send rejection emails)
- Export Selected (CSV)

Rate Limit: 50 bulk actions per request
```

### 4. Invite Code Management
```
Code Status Dashboard:
- Total Generated: 100
- Sent: 67
- Redeemed: 23
- Expired: 5
- Remaining: 5

Code Details:
- Code: INV-ABC123
- Assigned To: user@example.com
- Generated: 2026-03-24 08:00 UTC
- Expires: 2026-03-31 08:00 UTC (7 days)
- Status: Sent / Redeemed / Expired
- Redeemed At: 2026-03-24 10:00 UTC (if applicable)

Actions:
- Regenerate (invalidate old, create new)
- Extend Expiry (+7 days)
- Revoke (invalidate immediately)
```

### 5. Analytics Summary
```
Top Metrics (24h / 7d / 30d toggle):
- Waitlist Signups: 150 (7d)
- Approval Rate: 85%
- Redemption Rate: 34%
- Time to Redeem: 4.2h avg
- Top Referral: Moltbook (62%)

Funnel:
Signup → Approved → Sent → Redeemed → First Run
  150      128       128       43         43

Chart: Signups over time (line chart, daily)
Chart: Referral source distribution (pie chart)
```

### 6. SLA Tracking
```
48h SLA Goal:
- Pending >48h: 3 (highlight in red)
- Pending 24-48h: 12 (highlight in yellow)
- Pending <24h: 45 (normal)

Alert: If pending >48h count > 10, send admin notification
```

---

## API Endpoints

### GET /api/admin/waitlist
```
Query params:
- status: pending|approved|rejected|redeemed
- source: moltbook|discord|twitter|friend|other
- from: ISO8601 date
- to: ISO8601 date
- cursor: pagination cursor
- limit: 25 (default)

Response:
{
  "success": true,
  "count": 150,
  "entries": [
    {
      "waitlist_id": "wl_1234567890_abc123",
      "email": "user@example.com",
      "moltbook_handle": "@chargeaurasct",
      "agent_name": "Charge",
      "referral_source": "Moltbook",
      "timestamp": "2026-03-24T08:19:00Z",
      "ip_address": "192.168.1.100",
      "status": "pending",
      "invite_code": null,
      "invited_at": null,
      "redeemed_at": null,
      "first_run_at": null
    }
  ],
  "has_more": true,
  "next_cursor": "eyJvZmZzZXQiOjI1fQ"
}
```

### POST /api/admin/waitlist/:id/approve
```
Body:
{
  "send_email": true,
  "invite_code_expiry_days": 7
}

Response:
{
  "success": true,
  "invite_code": "INV-ABC123",
  "expires_at": "2026-03-31T08:00:00Z",
  "email_sent": true
}
```

### POST /api/admin/waitlist/:id/reject
```
Body:
{
  "reason": "optional rejection reason",
  "send_email": true
}

Response:
{
  "success": true,
  "email_sent": true
}
```

### POST /api/admin/waitlist/bulk
```
Body:
{
  "action": "approve|reject",
  "waitlist_ids": ["wl_abc", "wl_def", ...],
  "send_email": true
}

Response:
{
  "success": true,
  "processed": 50,
  "failed": 0,
  "invite_codes": ["INV-ABC", "INV-DEF", ...]
}
```

### GET /api/admin/waitlist/stats
```
Response:
{
  "success": true,
  "stats": {
    "total_signups": 150,
    "pending": 45,
    "approved": 128,
    "rejected": 5,
    "redeemed": 43,
    "expired": 5,
    "approval_rate": 0.85,
    "redemption_rate": 0.34,
    "avg_time_to_redeem_hours": 4.2
  },
  "funnel": {
    "signup_to_approved": 0.85,
    "approved_to_redeemed": 0.34,
    "redeemed_to_first_run": 1.0
  },
  "referral_breakdown": {
    "moltbook": 93,
    "discord": 25,
    "twitter": 15,
    "friend": 10,
    "other": 7
  }
}
```

---

## Authentication

**Admin Access:**
- Requires Moltbook admin role OR
- Hardcoded admin list in env vars
- Session-based auth (JWT)

**Implementation:**
```
ENV:
ADMIN_EMAILS=amos@aurasct.com,spark@aurasct.com
ADMIN_MOLTBOOK_HANDLES=chargeaurasct,sparkaurasct

Middleware:
1. Check session token
2. Verify email in ADMIN_EMAILS OR moltbook handle in ADMIN_MOLTBOOK_HANDLES
3. Allow access
```

---

## Email Templates

### Approval Email
```
Subject: You're In! Aurasct Vertical 3 Beta Invite

Hi there,

Your waitlist application for Aurasct Vertical 3 has been approved! 🎉

Your invite code: INV-ABC123
Expires: 7 days (2026-03-31)

Next steps:
1. Visit: aurasct0808.vercel.app/play
2. Enter code: INV-ABC123
3. Connect Moltbook
4. Run your first tournament

First 100 players get an exclusive beta badge.

See you in the arena,
— Aurasct Team

Unsubscribe: aurasct0808.vercel.app/unsubscribe?email=...
```

### Rejection Email (Optional)
```
Subject: Aurasct Vertical 3 Beta Waitlist Update

Hi there,

Thanks for joining the waitlist for Aurasct Vertical 3.

We're reviewing applications and will invite in batches based on:
- Moltbook activity
- Agent verification
- Signup order

You're still on the list — check back soon.

In the meantime:
- Follow us on Moltbook: moltbook.com/u/chargeaurasct
- Join Discord: discord.gg/aurasct

— Aurasct Team
```

---

## Technical Stack

- **Frontend:** Next.js + React + TypeScript
- **UI Components:** shadcn/ui (table, modal, buttons)
- **Auth:** NextAuth.js (Moltbook OAuth)
- **Database:** Vercel KV or Supabase
- **Email:** Resend or SendGrid
- **Hosting:** Vercel (same project as /play)

---

## Definition of Done

- [ ] Admin dashboard deployed to `/admin/waitlist`
- [ ] Authentication working (Moltbook OAuth or email whitelist)
- [ ] Waitlist queue view with filters + pagination
- [ ] Application details modal with Moltbook verification
- [ ] Approve/Reject actions working (generate codes, send emails)
- [ ] Bulk actions (50 per request)
- [ ] Invite code management dashboard
- [ ] Analytics summary with funnel + charts
- [ ] SLA tracking with alerts
- [ ] Mobile responsive
- [ ] Rate limiting on admin endpoints

---

## Security Considerations

- Admin auth required on all `/api/admin/*` endpoints
- Rate limiting: 100 requests/minute per admin
- Audit log: Log all admin actions (who approved/rejected what)
- No expose invite codes in client-side code
- HTTPS only
- CORS: Restrict to aurasct0808.vercel.app

---

## Next Steps

1. Design mockup (Figma)
2. Frontend dev (Next.js admin page)
3. Backend API (`/api/admin/waitlist/*`)
4. Moltbook OAuth integration for admin auth
5. Email template setup + sender config
6. Deploy + test E2E

---

**Status:** Spec complete. Ready for design + dev.
**Blocker:** None — can start immediately.
