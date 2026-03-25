# Aurasct Homepage Redesign

**Skill:** UI/UX Pro Max
**Preserved:** Color palette + Colosseum theme
**Goal:** Polish interface, improve UX flows, maintain institutional gravitas

---

## 1) Triage

**Target Platform:** Web (desktop + mobile responsive)
**Stack:** Next.js + Tailwind CSS (current Vercel deployment)
**Goal:** Conversion (waitlist signups) + institutional credibility
**Constraints:** 
- Preserve Colosseum theme (Roman classical aesthetic)
- Maintain dark color palette
- WCAG AA accessibility
- Private alpha positioning (exclusivity, not mass appeal)

**Current Assets:**
- Live auction dashboard
- Tournament results visualization
- Research positioning
- Waitlist capture

---

## 2) Design System Tokens

### Color Palette (Preserved + Refined)

```
--color-bg-primary: #0a0a0a      /* Deep black */
--color-bg-secondary: #111111    /* Card backgrounds */
--color-bg-tertiary: #1a1a1a     /* Hover states */
--color-text-primary: #ffffff    /* Headings */
--color-text-secondary: #a0a0a0  /* Body copy */
--color-text-muted: #666666      /* Meta info */
--color-accent-gold: #c9a961     /* Colosseum gold - primary CTA */
--color-accent-gold-hover: #e0c075
--color-accent-red: #8b2d2d      /* Arena red - alerts, urgency */
--color-border: #2a2a2a          /* Subtle dividers */
--color-success: #2d8b2d         /* Win states */
--color-error: #8b2d2d           /* Loss states */
```

### Typography Scale

```
--font-display: 'Playfair Display', serif     /* Roman inscription feel */
--font-body: 'IBM Plex Sans', sans-serif      /* Clean readability */
--font-mono: 'DM Mono', monospace             /* Data/terminal aesthetic */

--text-xs: 12px / 16px
--text-sm: 14px / 20px
--text-base: 16px / 24px
--text-lg: 18px / 28px
--text-xl: 20px / 30px
--text-2xl: 24px / 32px
--text-3xl: 30px / 40px
--text-4xl: 36px / 44px
--text-5xl: 48px / 56px
--text-6xl: 60px / 68px
```

### Spacing Scale

```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
--space-20: 80px
--space-24: 96px
```

### Border Radius

```
--radius-sm: 4px    /* Data cards, buttons */
--radius-md: 8px    /* Input fields, modals */
--radius-lg: 12px   /* Feature cards */
--radius-xl: 16px   /* Hero sections */
--radius-full: 9999px /* Pills, avatars */
```

### Shadow Tokens

```
--shadow-sm: 0 1px 2px rgba(0,0,0,0.3)
--shadow-md: 0 4px 8px rgba(0,0,0,0.4)
--shadow-lg: 0 8px 16px rgba(0,0,0,0.5)
--shadow-glow-gold: 0 0 20px rgba(201,169,97,0.3)
```

---

## 3) UI Concept + Layout

### Hero Section (Redesigned)

**Current:** Text-heavy, institutional framing
**New:** Visual hierarchy + clear CTA path

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   [Colosseum arch silhouette - subtle SVG background]      │
│                                                             │
│   AURASCT                                                  │
│   ─────────                                                │
│   [Gold underline, 60px width]                             │
│                                                             │
│   LLM Auction Behavioural Intelligence                     │
│   [text-2xl, text-secondary, max-w-2xl]                    │
│                                                             │
│   An empirical simulation platform studying strategic       │
│   behaviour of language model agents under intertemporal   │
│   payoffs, escalating multipliers, and adversarial         │
│   market mechanics.                                        │
│                                                             │
│   [Join Waitlist]  [Read the Rules]                        │
│   [gold bg, white] [transparent, gold border]              │
│                                                             │
│   Private Alpha · Institutional Access Only                │
│   [text-xs, text-muted, mt-8]                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Articles Section (Tournament Rules)

**Current:** Dense legal text, hard to scan
**New:** Card-based, progressive disclosure

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ARTICLES GOVERNING THE TOURNAMENT                        │
│   ─────────────────────────────                            │
│   [Gold divider line]                                      │
│                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │ Article I   │  │ Article II  │  │ Article III │       │
│   │ Structure   │  │ Mechanism   │  │ Multiplier  │       │
│   │             │  │             │  │             │       │
│   │ 15 Periods  │  │ Vickrey     │  │ 1× → 1.5×   │       │
│   │ 3 Stages    │  │ Sealed Bid  │  │ → 3×        │       │
│   │             │  │             │  │             │       │
│   │ [Read →]    │  │ [Read →]    │  │ [Read →]    │       │
│   └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │ Article IV  │  │ Article V   │  │ Article VI  │       │
│   │ Treasury    │  │ Rescission  │  │ Stage Points│       │
│   │             │  │             │  │             │       │
│   │ $10,000     │  │ Information │  │ Standing    │       │
│   │ Budget      │  │ Asymmetry   │  │ Determinant │       │
│   │             │  │             │  │             │       │
│   │ [Read →]    │  │ [Read →]    │  │ [Read →]    │       │
│   └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Live Auction Dashboard (Enhanced)

**Current:** Data viz, hover for reasoning
**New:** Real-time status + clearer state indicators

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   LIVE AUCTION SIMULATION                                  │
│   ──────────────────────                                   │
│   [Green pulse animation on "LIVE"]                        │
│                                                             │
│   ┌───────────────────────────────────────────────────┐    │
│   │                                                   │    │
│   │   Stage: S2 · 1.5×                                │    │
│   │   Period: P3 / 5                                  │    │
│   │   Floor Price: $15.00                             │    │
│   │                                                   │    │
│   │   [══════════════════════════════════════]        │    │
│   │   [Progress bar: Period 3 of 5]                   │    │
│   │                                                   │    │
│   └───────────────────────────────────────────────────┘    │
│                                                             │
│   Agent Bidding Behaviour                                  │
│   ─────────────────────                                    │
│                                                             │
│   [Interactive scatter plot - bid vs period]               │
│   [Hover: Show agent reasoning tooltip]                    │
│   [Legend: Color by agent, size by bid amount]             │
│                                                             │
│   [All Stages] [S1 · 1×] [S2 · 1.5×] [S3 · 3×]            │
│   [Filter pills]                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Ask the Platform (Chat Interface)

**Current:** Text input, suggested questions
**New:** Conversation bubbles, clearer affordances

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Ask the Platform                                         │
│   ─────────────────                                        │
│                                                             │
│   ┌───────────────────────────────────────────────────┐    │
│   │                                                   │    │
│   │   🤖 Aurasct Guide                                │    │
│   │   I can explain any aspect of the Aurasct         │    │
│   │   tournament: the Vickrey mechanism, intertemporal│    │
│   │   budget allocation, the rescind mechanic...      │    │
│   │                                                   │    │
│   │   What would you like to explore?                 │    │
│   │                                                   │    │
│   └───────────────────────────────────────────────────┘    │
│                                                             │
│   ┌───────────────────────────────────────────────────┐    │
│   │                                                   │    │
│   │   [💬] Why does truthful bidding break?           │    │
│   │   [💬] How does rescind work?                     │    │
│   │   [💬] Optimal budget allocation?                 │    │
│   │   [💬] IPO book-building analogy?                 │    │
│   │                                                   │    │
│   └───────────────────────────────────────────────────┘    │
│                                                             │
│   ┌───────────────────────────────────────────────────┐    │
│   │ Type your question...                       [→]   │    │
│   └───────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Built for Institutions (Value Props)

**Current:** 3-column feature list
**New:** Benefit-driven, social proof integrated

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Built for Institutions. Tested by Machines.              │
│   ─────────────────────────────────────────                │
│   [Gold divider]                                           │
│                                                             │
│   Private trial for exchanges, ECM desks, and regulators   │
│   seeking behavioural intelligence for primary issuance    │
│   design. The 20-week trial dataset is the core product.   │
│                                                             │
│   ┌───────────────────────────────────────────────────┐    │
│   │                                                   │    │
│   │   01  Agent Simulation Engine                     │    │
│   │   ─────────────────────                           │    │
│   │   Run thousands of tournament variations.         │    │
│   │   Bot vs bot, human vs bot, human vs human.       │    │
│   │                                                   │    │
│   │   → See sample runs                               │    │
│   │                                                   │    │
│   └───────────────────────────────────────────────────┘    │
│                                                             │
│   ┌───────────────────────────────────────────────────┐    │
│   │                                                   │    │
│   │   02  Behavioural Dataset                         │    │
│   │   ─────────────────────                           │    │
│   │   Proprietary LLM reasoning traces across         │    │
│   │   350+ tournament runs. The data is the moat.     │
│   │                                                   │    │
│   │   → Explore dataset schema                        │    │
│   │                                                   │    │
│   └───────────────────────────────────────────────────┘    │
│                                                             │
│   ┌───────────────────────────────────────────────────┐    │
│   │                                                   │    │
│   │   03  API-Native Integration                      │    │
│   │   ─────────────────────                           │    │
│   │   Embed into existing exchange infrastructure.    │    │
│   │   SGX, HKEX, ECM desk workflows.                  │    │
│   │                                                   │    │
│   │   → View API docs                                 │    │
│   │                                                   │    │
│   └───────────────────────────────────────────────────┘    │
│                                                             │
│   ┌───────────────────────────────────────────────────┐    │
│   │                                                   │    │
│   │   Request Access                                  │    │
│   │   ─────────────                                   │    │
│   │                                                   │    │
│   │   [Email input] [Request →]                       │    │
│   │                                                   │    │
│   │   Access is granted to verified institutions only.│    │
│   │   No retail participants.                         │    │
│   │                                                   │    │
│   └───────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4) UX Flow

### Primary Conversion Funnel

```
Landing Page
    ↓
[Hero CTA: "Join Waitlist"]
    ↓
Waitlist Modal
    ↓
[Email + Institution + Role]
    ↓
Verification Email Sent
    ↓
[Click Verification Link]
    ↓
Access Granted (if institution verified)
    ↓
Dashboard Access + Tournament Invite
```

### Secondary Flow (Research Exploration)

```
Landing Page
    ↓
[Read the Rules]
    ↓
Articles Modal (Card-based)
    ↓
[Article Detail Expand]
    ↓
[Ask the Platform - Chat]
    ↓
[Engagement → Waitlist Signup]
```

### Error States

| State | Message | Action |
|-------|---------|--------|
| Email already registered | "This institution is already in the queue. Check your inbox." | Resend verification |
| Invalid institution domain | "Access is limited to verified institutions. Contact research@aurasct.com" | Manual review request |
| Rate limit hit | "Too many requests. Please wait 1 hour." | Retry after delay |
| Chat error | "I'm unable to process that question. Try rephrasing." | Suggest alternative questions |

---

## 5) Component Specs

### Button Component

```
<button class="btn-primary">
  background: var(--color-accent-gold)
  color: #ffffff
  padding: 12px 24px
  border-radius: var(--radius-sm)
  font-weight: 600
  transition: all 0.2s
  
  :hover {
    background: var(--color-accent-gold-hover)
    transform: translateY(-1px)
    box-shadow: var(--shadow-glow-gold)
  }
  
  :disabled {
    background: var(--color-text-muted)
    cursor: not-allowed
  }
}
```

### Card Component (Articles)

```
<article class="rule-card">
  background: var(--color-bg-secondary)
  border: 1px solid var(--color-border)
  border-radius: var(--radius-lg)
  padding: var(--space-6)
  transition: all 0.2s
  
  :hover {
    border-color: var(--color-accent-gold)
    transform: translateY(-2px)
    box-shadow: var(--shadow-lg)
  }
  
  h3 {
    font-family: var(--font-display)
    color: var(--color-text-primary)
    margin-bottom: var(--space-2)
  }
  
  p {
    color: var(--color-text-secondary)
    font-size: var(--text-sm)
    line-height: 1.6
  }
  
  .cta {
    color: var(--color-accent-gold)
    font-weight: 500
    margin-top: var(--space-4)
  }
}
```

### Input Component (Waitlist)

```
<input class="input-field" type="email">
  background: var(--color-bg-tertiary)
  border: 1px solid var(--color-border)
  border-radius: var(--radius-md)
  padding: 12px 16px
  color: var(--color-text-primary)
  font-size: var(--text-base)
  width: 100%
  
  :focus {
    outline: none
    border-color: var(--color-accent-gold)
    box-shadow: 0 0 0 2px rgba(201,169,97,0.2)
  }
  
  :error {
    border-color: var(--color-error)
    box-shadow: 0 0 0 2px rgba(139,45,45,0.2)
  }
```

---

## 6) Accessibility

### WCAG AA Requirements

- **Color contrast:** All text ≥ 4.5:1 ratio (gold on black: 8.2:1 ✓)
- **Keyboard navigation:** All interactive elements focusable
- **Focus states:** Visible gold glow on focus
- **Screen reader:** ARIA labels on all buttons, inputs, cards
- **Error messages:** Linked to inputs via `aria-describedby`
- **Loading states:** Announced via `aria-live` regions

### Keyboard Navigation Order

```
1. Logo (skip link available)
2. Main nav links
3. Hero CTA buttons
4. Article cards (tab through)
5. Live dashboard controls
6. Chat input
7. Waitlist form
8. Footer links
```

---

## 7) Implementation Plan

### File Structure

```
/workspace-vertical3/
├── src/
│   ├── components/
│   │   ├── Hero.tsx
│   │   ├── ArticlesGrid.tsx
│   │   ├── AuctionDashboard.tsx
│   │   ├── ChatInterface.tsx
│   │   ├── WaitlistForm.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Input.tsx
│   │       └── Modal.tsx
│   ├── styles/
│   │   ├── tokens.css (design tokens)
│   │   └── global.css
│   ├── pages/
│   │   ├── index.tsx (homepage)
│   │   ├── tournaments.tsx
│   │   └── agents.tsx
│   └── lib/
│       ├── api.ts
│       └── utils.ts
├── public/
│   ├── colosseum-arch.svg (background)
│   └── favicon.ico
└── redesign/
    └── aurasct-home-redesign.md (this spec)
```

### Phase 1: Design Tokens (Day 1)

1. Create `styles/tokens.css` with all CSS variables
2. Update `tailwind.config.js` to use custom tokens
3. Test color contrast ratios
4. Verify typography scale renders correctly

### Phase 2: Component Library (Day 2-3)

1. Build Button, Card, Input, Modal components
2. Implement hover/focus/disabled states
3. Add ARIA labels for accessibility
4. Write unit tests (Jest + React Testing Library)

### Phase 3: Page Redesign (Day 4-5)

1. Redesign `pages/index.tsx` (homepage)
2. Implement ArticlesGrid with modal expansion
3. Enhance AuctionDashboard with real-time status
4. Polish ChatInterface with conversation bubbles

### Phase 4: QA + Launch (Day 6-7)

1. Cross-browser testing (Chrome, Firefox, Safari, Edge)
2. Mobile responsive testing (320px → 1920px)
3. Accessibility audit (axe-core, Lighthouse)
4. Performance optimization (LCP < 2.5s, CLS < 0.1)
5. Deploy to Vercel staging
6. User testing (5 institutional users)
7. Production deploy

---

## 8) Acceptance Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Load time (LCP) | < 2.5s | Lighthouse |
| Color contrast | ≥ 4.5:1 | axe-core |
| Keyboard nav | 100% focusable | Manual audit |
| Mobile responsive | 320px → 1920px | BrowserStack |
| Waitlist conversion | +20% vs current | Analytics |
| Bounce rate | -15% vs current | Analytics |
| Chat engagement | +30% questions asked | Event tracking |

---

**Status:** Spec complete. Ready for implementation.
**Preserved:** Colosseum theme, gold accent color, institutional positioning.
**Enhanced:** Visual hierarchy, UX flows, accessibility, component system.
