# hop Expansion Roadmap

**Source**: 108-agent deep-research pass, adversarially verified (3-vote consensus), June 2026.
**For agents**: Each section is a self-contained workstream. Pick one, implement it, open a PR.

---

## Moat summary (don't break this)

hop's core advantage is **verdict quality, not program breadth**: cpp is computed
deterministically from the user's real balances — never LLM-generated. No confirmed competitor
does this. Every expansion must preserve the invariant: every number is computed, never generated.

---

## Workstreams (priority order)

### 1. Proactive alerts — High impact / Medium effort

**What**: When award availability opens or cpp crosses a threshold, notify the user.  
**Why**: The dominant freemium gate in this category. PointsYeah (NerdWallet 2026 #1) gates 32 active alerts behind $99.99/year premium. Roame gates route alerts behind paid "Friends of Roame". Pattern is proven: free search → paid alerts.  
**Implementation sketch**:
- Supabase `hop_alerts` table: `user_id`, `from_code`, `to_code`, `program`, `threshold_cpp`, `notify_email`, `active`
- Vercel cron (add to `vercel.json`) hits `/api/cron/check-alerts` every hour
- Re-uses `lib/seatsaero.ts` + `lib/cpp.ts` — no new upstream clients needed
- Email via Resend (already in env or trivial to add)
- UI: `/account` alerts tab + a "set alert" button on search result rows
- Gate: free tier = 3 alerts, premium = unlimited (sets up the subscription paywall)

**Files to touch**: `vercel.json`, `lib/alerts.ts` (new), `app/api/cron/check-alerts/route.ts` (new), `app/account/page.tsx`, search result components.

---

### 2. Credit card affiliate CTAs — High impact / Low effort

**What**: On verdict pages, surface a "Earn the points for this trip" card recommendation linking to an affiliate application.  
**Why**: Commissions up to $405/approval (Luxury Card via CJ Affiliate, 30-day cookie) vs. Kiwi cash-fare links which pay far less per conversion. Travel-hacker audience is self-selecting — they are prime card applicants.  
**Implementation sketch**:
- `lib/card-affiliates.ts`: static map of `program_code → { card_name, issuer, affiliate_url, earn_rate, bonus_miles, commission_note }`
- On the search verdict, below the winning option: "Don't have [United miles]? Earn [80,000] with the [United Explorer Card] →"
- `components/CardAffiliateCTA.tsx` — small, dismissible chip, not intrusive
- Only show when the winning option is a points redemption (don't push cards on cash verdicts)
- Track clicks with a `?ref=hop-card` param

**Files to touch**: `lib/card-affiliates.ts` (new), `components/CardAffiliateCTA.tsx` (new), `app/search/page.tsx` (or wherever verdict is rendered).

---

### 3. Subscription paywall — High impact / Medium effort

**Market benchmark**: $99.99/year with a free tier (PointsYeah, NerdWallet 2026 #1).  
**What**: Gate alerts (workstream 1) and future premium features behind a Stripe subscription.  
**Implementation sketch**:
- Stripe Products: Free (3 alerts, 1 search/day), Premium ($9.99/mo or $99/yr, unlimited alerts, all features)
- `lib/subscription.ts`: `getUserTier(userId)` → `'free' | 'premium'` (reads Supabase `hop_subscriptions`)
- Stripe webhooks → `/api/webhooks/stripe/route.ts` to update `hop_subscriptions`
- `/account/billing` page with upgrade flow
- Feature flag `isPremium` threaded into alerts and any future gated features
- `isCheckoutEnabled()` pattern already exists — follow it

**Files to touch**: `lib/subscription.ts` (new), `app/account/billing/page.tsx` (new), `app/api/webhooks/stripe/route.ts` (new), `lib/env.ts` (add `STRIPE_*` keys).

---

### 4. MCP tool additions — Medium impact / Low effort

**Context**: A competitor MCP (Flightpoints) already does award search across 40+ programs with a free no-key tier. The commodity is availability search. hop's differentiation is economics (verdict, cpp, user balances).  
**What**: Add new MCP tools that competitors can't replicate.  
**Tools to add**:
- `compare_programs(from, to, depart, programs[])` — side-by-side cpp for named programs, returns ranked table. Useful for "should I use my Chase points or transfer to United?"
- `alert_register(from, to, program, threshold_cpp)` — registers an alert for the calling user's hop token (requires Bearer auth). Pairs with workstream 1.
- `best_card_for_program(program_code)` — returns the top earn card for a program with affiliate link. Pairs with workstream 2.

**Files to touch**: `app/api/[transport]/route.ts`, `lib/mcp-tools.ts`.

---

### 5. SEO content flywheel — Medium impact / Medium effort

**What**: Computed destination/program/sweet-spot guide pages that rank for commercial-intent queries.  
**Why**: hop's verdict engine produces defensible, computed data no content farm can replicate. "Best way to use United miles", "SFO to Tokyo award sweet spots", "Chase vs Amex transfer partners" are high-value queries with affiliate upside.  
**Implementation sketch** (see also `docs/content-plan.md §4` for the full spec):
- `/sweet-spots/[program]` — top 10 redemptions by cpp for a program, updated nightly
- `/compare/[program-a]-vs-[program-b]` — head-to-head: earn rates, transfer partners, sweet spots
- `/destinations/[city]` — which programs fly there, best cpp, sample itinerary
- All pages are RSC, statically generated at build, data from `lib/destinations.ts` + `lib/cpp.ts`
- JSON-LD `FAQPage` + `HowTo` structured data on each

**Files to touch**: `app/sweet-spots/[program]/page.tsx` (new), `app/compare/[slug]/page.tsx` (new), `app/destinations/[city]/page.tsx` (new), `lib/destinations.ts` (extend).

---

### 6. Concierge escalation tier — High impact / High effort

**Market validation**: Point.me charges $200/passenger for done-for-you award bookings.  
**What**: From /ask, a user can escalate to "book this for me" — either a human expert or an agentic flow that completes the booking.  
**Phase 1 (MVP)**: "Request expert booking" button on /ask that submits a form to a Notion/Linear queue for manual follow-up. No automation needed to validate demand.  
**Phase 2**: Agentic booking via MCP tools + Duffel (already integrated, gated behind `isCheckoutEnabled()`).  
**Files to touch**: `app/ask/page.tsx`, `app/api/concierge-escalation/route.ts` (new), `components/EscalationCTA.tsx` (new).

---

### 7. Hotel awards — High impact / Very high effort (defer)

**Why complex**: Resort-fee waivers differ by chain (Hilton waives on all-points bookings; Marriott/IHG don't), fifth-night-free (Hyatt, IHG), fourth-night-free (Amex FHR), elite-night credit, points-earning opportunity cost — all chain-specific rule tables. This is 3–5× more complex than the flight cpp formula.  
**Recommendation**: Defer until workstreams 1–3 are monetized. Then scope a `lib/hotel-cpp.ts` with a pluggable rule table per chain.

---

## Competitive landscape (agent context)

| Competitor | Programs | Verdict? | MCP? | Alerts? | Concierge? |
|---|---|---|---|---|---|
| **PointsYeah** | ~20 | No | No | Yes (32 for $99/yr) | No |
| **Roame** | 21+ | No | No | Yes (paid) | No |
| **Point.me** | 30+, 150+ airlines | No | No | No | Yes ($200/pax) |
| **Seats.aero** | 25+ | No | No | Yes (paid) | No |
| **Flightpoints MCP** | 40+ | No | Yes (search only) | No | No |
| **hop** | Seats.aero + Duffel | **Yes** | **Yes (verdict+econ)** | Planned | /ask (AI) |

hop's gap: alerts, subscription, card affiliates. Those three close the monetization gap while the verdict moat widens.

---

## Environment variables needed (not yet in .env)

| Workstream | Key | Purpose |
|---|---|---|
| 3 (subscription) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe billing |
| 2 (affiliates) | `CJ_AFFILIATE_TAG` | Commission Junction tag for card links |
| 1 (alerts) | `RESEND_API_KEY` | Transactional email for alert notifications |
