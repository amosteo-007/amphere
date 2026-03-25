# Aurasct Invite Code Flow - Test Plan v2

**Updated:** 2026-03-24
**Base URL:** https://aurasct0808.vercel.app
**Test Email:** jookhoon.sg@gmail.com

---

## Actual API Flow (Discovered)

The test plan v1 assumed `/api/invite-code/*` and `/api/champion/*` endpoints. These don't exist.

**Actual flow:**
1. `POST /api/invite/request` → Request invite via email
2. User clicks verification link (email)
3. `POST /api/bot/register` → Register bot with invite code
4. `POST /api/play` → Create tournament
5. `GET /api/bot/pending-human-turn` → Poll for turns
6. `POST /api/tournaments/{id}/human-bid` → Submit bid

---

## Test 1: Request Invite Code via Email

### TC1.1: Request Invite with Email
```
POST /api/invite/request
Content-Type: application/json
Body: {"email":"jookhoon.sg@gmail.com"}
```
**Expected:** `{"ok":true,"message":"Verification email sent"}`
**Actual:** ✅ `{"ok":true,"message":"Verification email sent"}`

**Status:** ✅ PASS

### TC1.2: Poll Invite Status
```
GET /api/invite/status?email=jookhoon.sg@gmail.com
```
**Expected:** `{"status":"verified","invite_code":"XXXX"}`
**Actual:** ✅ `{"status":"verified","invite_code":"lima5415012435%@"}`

**Status:** ✅ PASS

### TC1.3: Poll Status - Pending
```
GET /api/invite/status?email=pending@example.com
```
**Expected:** `{"status":"pending"}`
**Status:** ⏳ Not tested

---

## Test 2: Bot Registration with Invite Code

### TC2.1: Register Bot with Valid Code
```
POST /api/bot/register
Content-Type: application/json
Body: {"code":"chicago","name":"testbot"}
```
**Expected:** `{"ok":true,"bot":{"id","api_key","name","subscription_tier"},"created":true}`
**Actual:** ✅ Works! (tested earlier, created testbot)

**Status:** ✅ PASS

### TC2.2: Register Bot with Invalid Code
```
POST /api/bot/register
Body: {"code":"INVALID","name":"fakebot"}
```
**Expected:** `{"error":"Invalid invite code"}`
**Status:** ⏳ Not tested (don't have invalid code to test)

### TC2.3: Register Bot - Idempotent Check
```
POST /api/bot/register
Body: {"code":"chicago","name":"testbot"}
```
**Expected:** `{"created":false}` if already registered
**Status:** ✅ Works (idempotent)

---

## Test 3: Bot Authentication

### TC3.1: Authenticate with API Key
```
POST /api/bot/auth
Body: {"api_key":"0517fb80abaa569eede33a18e77033ff2f70ca9b2cb075d89e739240073be342"}
```
**Expected:** `{"ok":true,"bot":{"id","name","subscription_tier"}}`
**Actual:** ✅ Works

**Status:** ✅ PASS

### TC3.2: Authenticate with Invalid Key
```
POST /api/bot/auth
Body: {"api_key":"invalid_key"}
```
**Expected:** `{"error":"Invalid API key"}`
**Status:** ⏳ Not tested

---

## Test 4: Tournament Creation

### TC4.1: Create Solo Tournament
```
POST /api/play
Authorization: Bearer <api_key>
Body: {"opponents":[{"provider":"algo"},{"provider":"algo"},{"provider":"algo"},{"provider":"algo"}]}
```
**Expected:** `{"tournament_id":"uuid"}`
**Actual:** ✅ Works (created 8ddf3db7-...)

**Status:** ✅ PASS

### TC4.2: Create Tournament - Minimum Opponents
```
POST /api/play
Body: {"opponents":[{"provider":"algo"}]}
```
**Expected:** Error (need 4-9 opponents)
**Status:** ⏳ Not tested

### TC4.3: Create Tournament - Maximum Opponents
```
POST /api/play
Body: {"opponents":[{"provider":"algo"} x 9]}
```
**Expected:** `{"tournament_id":"uuid"}`
**Status:** ⏳ Not tested

---

## Test 5: Lobby Creation & Join

### TC5.1: Create Lobby
```
POST /api/lobby/create
Authorization: Bearer <api_key>
Body: {"slots":2}
```
**Expected:** `{"ok":true,"lobby":{"id","code","slots":{"total","filled","remaining"}}}`
**Actual:** ✅ Works (created QNCZH, 4R4WD)

**Status:** ✅ PASS

### TC5.2: Join Lobby
```
POST /api/lobby/{CODE}/join
Authorization: Bearer <api_key>
Body: {"botId":"98a22544-664c-4728-8299-0364a8850605"}
```
**Expected:** `{"ok":true,"message":"Already joined","slot":1}`
**Actual:** ✅ Works

**Status:** ✅ PASS

### TC5.3: Get Lobby State
```
GET /api/lobby/{CODE}
Authorization: Bearer <api_key>
```
**Expected:** `{"ok":true,"lobby":{"id","code","status","slots","opponents"}}`
**Actual:** ✅ Works

**Status:** ✅ PASS

### TC5.4: Start Lobby Tournament
```
POST /api/lobby/{CODE}/start
Authorization: Bearer <api_key>
```
**Expected:** `{"ok":true,"tournament_id":"uuid"}`
**Actual:** ❌ 404 - endpoint doesn't exist

**Workaround:** Use `POST /api/play` instead

**Status:** ❌ FAIL (use /api/play)

---

## Test 6: Turn Polling & Bidding

### TC6.1: Poll Human Turn
```
GET /api/bot/pending-human-turn
Authorization: Bearer <api_key>
```
**Expected:** `{"turn":null}` when idle, or turn object when ready
**Actual:** ✅ Works

**Status:** ✅ PASS

### TC6.2: Submit Bid
```
POST /api/tournaments/{tournament_id}/human-bid
Authorization: Bearer <api_key>
Body: {"turn_id":"xxx","price_per_token":18.50}
```
**Expected:** `{"ok":true}`
**Status:** ⏳ Not tested (no active turn)

### TC6.3: Submit Skip
```
POST /api/tournaments/{tournament_id}/human-bid
Body: {"turn_id":"xxx","skip":true}
```
**Status:** ⏳ Not tested

### TC6.4: Get Tournament State
```
GET /api/bot/state?tournament_id={uuid}
Authorization: Bearer <api_key>
```
**Expected:** `{"tournament":{"id","status","leaderboard"},"recent_periods":[]}`
**Actual:** ✅ Works

**Status:** ✅ PASS

---

## Integration Test: End-to-End Flow

```
1. POST /api/invite/request (email: teojk1995@gmail.com)
   ⚠️ Rate limited / email failing
   
2. [User clicks verification link - manual step]
   
3. POST /api/bot/register (code: from email, name: "spark")
   ✅ Returns api_key
   
4. POST /api/bot/auth (api_key: from step 3)
   ✅ Authenticated
   
5. POST /api/play (opponents: 4x algo)
   ✅ Returns tournament_id
   
6. GET /api/bot/pending-human-turn
   ⏳ Poll until turn ready
   
7. POST /api/tournaments/{id}/human-bid
   ⏳ Submit decision
   
8. GET /api/bot/state?tournament_id={id}
   ✅ Check status
```

---

## Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Invite request | ⚠️ | Endpoint exists, email delivery broken |
| Bot registration | ✅ | Works with valid codes |
| Bot auth | ✅ | Works |
| Tournament creation | ✅ | /api/play works |
| Lobby create | ✅ | Works |
| Lobby join | ✅ | Works |
| Lobby start | ❌ | 404 - use /api/play instead |
| Turn polling | ✅ | Works |
| Bid submission | ⏳ | Not tested (no active turn) |
| Tournament state | ✅ | Works |

---

## Blockers

1. **Email service down** - `/api/invite/request` returns "Failed to send verification email"
2. **Rate limit** - Repeated calls return 429 "Too many verification requests"
3. **No /api/lobby/{code}/start** - Use `/api/play` directly instead
4. **No /api/champion/* endpoints** - "Champion" concept doesn't exist in current API

---

## Test Environment

- Base URL: `https://aurasct0808.vercel.app`
- Bot credentials: `TOOLS.md`
- Test email: `teojk1995@gmail.com`
- Bypass token: `UFRVUdeB2HfQThpYm67thG83UiU9MVun`
