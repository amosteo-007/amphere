# Aurasct Invite Code Genesis Flow - Test Specification

## Overview

Test the complete invite code genesis flow: code creation → verification → champion onboarding → lobby participation.

---

## Test 1: Agent Can Create Invite Code

### Prerequisites
- Valid bot credentials (botId, apiKey)
- Owner-provided identifier (email OR telegram handle)

### Test Cases

#### TC1.1: Create Invite Code with Email
```
POST /api/invite-code/create
Headers: Authorization: Bearer <api_key>
Body: {
  "email": "teonk1995@gmail.com",
  "botId": "98a22544-664c-4728-8299-0364a8850605"
}
Expected: 200 OK, { code: "XXXX", status: "pending" }
```

#### TC1.2: Create Invite Code with Telegram Handle
```
POST /api/invite-code/create
Headers: Authorization: Bearer <api_key>
Body: {
  "telegram": "@thk4amos",
  "botId": "98a22544-664c-4728-8299-0364a8850605"
}
Expected: 200 OK, { code: "XXXX", status: "pending" }
```

#### TC1.3: Create Invite Code - Missing Identifier
```
POST /api/invite-code/create
Headers: Authorization: Bearer <api_key>
Body: {
  "botId": "98a22544-664c-4728-8299-0364a8850605"
}
Expected: 400 Bad Request, { error: "email or telegram required" }
```

#### TC1.4: Create Invite Code - Invalid API Key
```
POST /api/invite-code/create
Headers: Authorization: Bearer invalid_key
Body: {
  "email": "teonk1995@gmail.com"
}
Expected: 401 Unauthorized
```

### Success Criteria
- Invite code generated and returned
- Code linked to bot + owner identifier
- Code status trackable (pending → verified → active)

---

## Test 2: Agent Onboards as New Champion After Verification

### Prerequisites
- Valid invite code from Test 1
- Code status = "verified" or "active"

### Test Cases

#### TC2.1: Champion Onboarding with Valid Code
```
POST /api/champion/onboard
Headers: Authorization: Bearer <api_key>
Body: {
  "inviteCode": "XXXX",
  "botId": "98a22544-664c-4728-8299-0364a8850605"
}
Expected: 200 OK, { championId: "xxx", status: "active", budget: 10000 }
```

#### TC2.2: Champion Onboarding - Code Already Used
```
POST /api/champion/onboard
Headers: Authorization: Bearer <api_key>
Body: {
  "inviteCode": "XXXX",
  "botId": "98a22544-664c-4728-8299-0364a8850605"
}
Expected: 409 Conflict, { error: "code already redeemed" }
```

#### TC2.3: Champion Onboarding - Invalid/Expired Code
```
POST /api/champion/onboard
Headers: Authorization: Bearer <api_key>
Body: {
  "inviteCode": "INVALID"
}
Expected: 400 Bad Request, { error: "invalid or expired code" }
```

#### TC2.4: Champion Onboarding - Verify Champion Profile
```
GET /api/champion/<championId>
Headers: Authorization: Bearer <api_key>
Expected: 200 OK, { id, botId, budget, stagePoints, tournaments: [] }
```

### Success Criteria
- Champion profile created
- Budget allocated ($10,000)
- Champion can participate in tournaments

---

## Test 3: Champion Can Start or Join a Lobby

### Prerequisites
- Active champion account from Test 2
- Valid authentication

### Test Cases

#### TC3.1: Champion Creates New Lobby
```
POST /api/lobby/create
Headers: Authorization: Bearer <api_key>
Body: {
  "championId": "xxx",
  "slots": 2-8
}
Expected: 200 OK, { lobbyId: "xxx", code: "XXXX", slots: { total, filled, remaining } }
```

#### TC3.2: Champion Joins Existing Lobby
```
POST /api/lobby/<code>/join
Headers: Authorization: Bearer <api_key>
Body: {
  "championId": "xxx"
}
Expected: 200 OK, { message: "joined", slot: N, slots: { total, filled, remaining } }
```

#### TC3.3: Champion Joins Full Lobby
```
POST /api/lobby/<code>/join
Headers: Authorization: Bearer <api_key>
Body: {
  "championId": "xxx"
}
Expected: 409 Conflict, { error: "lobby full" }
```

#### TC3.4: Champion Starts Tournament from Lobby
```
POST /api/lobby/<code>/start
Headers: Authorization: Bearer <api_key>
Expected: 200 OK, { tournamentId: "xxx", status: "running", periods: 15 }
```

#### TC3.5: Verify Lobby State After Join
```
GET /api/lobby/<code>
Headers: Authorization: Bearer <api_key>
Expected: 200 OK, { id, code, slots, participants: [...], status: "waiting|running" }
```

### Success Criteria
- Lobby created with unique code
- Champion can join lobbies
- Tournament can be initiated from lobby

---

## Integration Test: End-to-End Flow

```
1. POST /api/invite-code/create (email: teonk1995@gmail.com)
   → code: "GENESIS01"

2. POST /api/champion/onboard (inviteCode: "GENESIS01")
   → championId: "champ_xxx", budget: 10000

3. POST /api/lobby/create
   → lobbyCode: "4R4WD"

4. POST /api/lobby/4R4WD/join
   → slot: 1, status: joined

5. GET /api/champion/champ_xxx
   → verify: budget=10000, lobbies=["4R4WD"], tournaments=[]
```

---

## Notes

### Current Blockers (as of 2026-03-23)
- No public `/api/invite-code/*` endpoint exists (404)
- No public `/api/champion/*` endpoint exists (404)
- Invite codes like "chicago" appear to be admin-generated only
- Site states "Access is granted to verified institutions only"

### Required Backend Implementation
- Invite code creation endpoint
- Code verification/activation flow
- Champion onboarding endpoint
- Champion profile management
- Lobby creation tied to champion (not just bot)

### Test Environment
- Base URL: `https://aurasct0808.vercel.app`
- Bot credentials stored in `TOOLS.md`
- Test email: `teonk1995@gmail.com`
- Test telegram: `@thk4amos`
