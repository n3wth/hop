# 2026-07-04 — The hop business plan: from working engine to profitable company

> Plan. Status: **adopted operating plan** for positioning, pricing, streams, and billing
> gates. **Sequencing for the next 90 days is `2026-08-20-path-to-first-dollar.md`.**
> TL;DR: hop has a genuinely differentiated product (real balances × deterministic
> points-vs-cash economics × agent-native distribution). Monetization rails that were "one
> wire short" on 2026-07-04 are largely wired; verified revenue is still $0 because
> distribution never landed and seats.aero was never taken off the paid path (won't-buy,
> 2026-08-21). This plan still sets positioning,
> pricing ($49/yr), cost model, and the four hard billing gates. It does not tell you what
> to build this week.

**How this doc relates to the others**: this is the *umbrella* for money math, pricing, and
gates. `docs/plans/2026-08-20-path-to-first-dollar.md` sequences the next 90 days.
`docs/plans/2026-08-21-replace-seatsaero.md` is the award-data replacement (gate ④ / ADR 0014).
`docs/plans/2026-07-03-critical-review-roadmap.md` remains the execution detail for R-items;
the individual `docs/plans/*` docs remain the implementation specs;
`docs/plans/2026-07-02-competitive-positioning.md` remains the positioning source.

**North-star extension**: see `2026-07-05-agentic-travel-agent-northstar.md` for the agentic
product vision (P1–P5). Its $10k-MRR-in-30-days goal expired 2026-08-05 at $0 and is not a
desk target.

**Tracker**: Linear team `n3wth`, project [hop](https://linear.app/newth/project/hop-9365da373b9a).
Every epic below exists as a Linear issue (`R#.#` / `B#` title prefixes, phase milestones).

---

## 1. Where the business stands (audited 2026-07-04, at `6e30e51`)

The engine is real; the business layer is scaffolded but unwired. Verified against code:

| Rail | State | The missing wire |
|---|---|---|
| Verdict engine + invariants | **Strong.** 812/812 tests, always-resolves, computed-numbers | Multi-passenger cpp bug (P1) inflates cpp ~party-size on live multi-pax searches |
| Subscriptions (Stripe) | Built twice, works zero times | Gated checkout never creates `hop_customers`; live webhook throws "Customer not found" → payer stays free. Tested mapper (`lib/billing.ts`) wired to nothing |
| Cash affiliate (Kiwi) | Travelpayouts JS tag only | No first-party `affilid`, no ledger reconciliation (`lib/booking.ts#cashBookingUrl`) |
| Card affiliate | 15-card table + click ledger built | `applyUrl`s are placeholder public pages; CJ/Impact partnership not applied for |
| Concierge escalation | Lead capture live (`hop_escalations`) | No payment; deliberate Phase-1 demand measurement |
| MCP server | 6 tools, hashed `hop_` tokens, usage logging | Free and commercially unmetered; no quota, no tier |
| Alerts (retention engine) | Cron + idempotent outbox + Resend built | `STANDING_ORDERS_CRON_ENABLED` off; DKIM unverified — the promise "hop pings you" is dark |
| Product analytics | LLM-cost spans + page views only | Zero funnel events; founder is flying blind |
| Pricing surface | `/account#billing` section only | No public `/pricing`; `.env.example` omits every billing key |

Full audit detail: §1 of the critical-review roadmap plus the 2026-07-04 built-vs-stubbed
inventory that produced this table (both verified at file:line).

## 2. Positioning (decided — see competitive-positioning doc)

- **Category**: the **points-vs-cash verdict engine** — the loyalty-economics layer both humans
  and AI agents call. Never "AI travel planner" (151-competitor, $6.99/mo, low-trust category).
- **One-liner**: *"Every award tool can tell you a seat exists. hop tells you whether to burn
  **your** points on it — and any AI agent can ask it the same question."*
- **ICP (consumer)**: US points-and-miles enthusiasts who already pay for tools — the
  r/awardtravel / FlyerTalk / points-blog audience. Demonstrated willingness to pay:
  Seats.aero Pro $99.99/yr, PointsYeah $99.99/yr, Roame $109.99/yr, point.me $129–260/yr,
  Daily Drop Pro $149/yr, Thrifty Traveler $129.99/yr, Going Elite $199/yr (all verified
  current 2026-07-04).
- **ICP (agent/B2B)**: AI assistants and issuer/fintech travel surfaces that need a
  deterministic points-vs-cash answer. Every agent-native competitor is *stateless* search;
  hop's authenticated MCP is "the only points brain an agent can call that already knows what
  you hold." Bilt→Points Path and Capital One internalizing Hopper's portal prove issuers buy
  this layer.
- **Moat discipline**: differentiation lives in the verdict + linked balances + first-party
  observed-cpp telemetry — never the data layer (seats.aero powers competitors too).

## 3. Revenue model & pricing (the decisions)

Five streams, ranked by (effort × fit × expected value). Numbers are engine/config constants or
partner-set rates — never LLM-generated.

### 3.1 hop Pro — subscription (primary consumer stream)
- **Launch price: $49/yr, annual-only, explicitly early-adopter, grandfathered for life.**
  Rationale: half the category floor ($99.99) is honest while coverage/reputation are unearned
  (roadmap R3.2's argument, adopted); annual-only simplifies the rail and matches the Going
  Premium $49 anchor; Thrifty Traveler's price-lock proved lifetime-grandfathering drives
  urgency without slop. The built Stripe rail already supports monthly ($9.99) — keep the
  price id configured but hide monthly at launch.
- **Raise to $99/yr** (new customers only) when all three: alerts firing reliably for 60+ days;
  ≥8 programs clear the live-valuation 20-sample gate (so `/stats` argues *for* us); verdict
  receipts + newsletter shipped.
- **Free tier**: full search + verdict (rate-limited), 3 alerts, MCP 25 calls/day/token.
  **Pro**: unlimited alerts, MCP 1,000 calls/day, weekly best-redemption digest.
  The free/paid line is *proactivity and volume*, never verdict quality — degrading the core
  answer would kill the trust the brand is.
- **Gate to flip `HOP_ENABLE_BILLING` (all four, hard)**: ① R0.1 multi-pax cpp fixed; ② R0.2
  single tested Stripe lane with one real purchase; ③ alerts actually firing (R0.4 + R1.3);
  ④ seats.aero **off the commercial/paid search path** (R3.1, amended 2026-08-21 /
  ADR 0014) — founder will not buy the commercial license. Chart-cpp at honest-copy
  parity with the Partner API **not called** is the gate. Do not charge Pro on an
  unlicensed seats.aero feed; a failover that keeps seats.aero primary does not pass.

### 3.2 Card affiliates (highest $/event)
Public payouts $25–200+/approval (premium travel cards top the range; $250–400 folklore is
unverified). One approval ≈ 1–2 years of a Pro sub. Code is ready (table + click ledger +
`/api/go/card` redirect); the blocker is the CJ/Impact application — **owner action, start now,
approval latency is the timeline**. Judged by the outclick baseline from R0.5/R0.6.

### 3.3 Cash-booking affiliate (small, always-on)
Kiwi via Travelpayouts ≈ 3%/booking (≈ $15 on a $500 ticket). Verify the tag actually decorates
clicks (R0.6), add the first-party `/api/go/kiwi` ledger so commissions are reconcilable.
Native Duffel checkout stays TEST-key-only; live-key markup is rejected (needs its own ADR).

### 3.4 Concierge escalation — "hop books it" ($149 flat, Phase 2)
point.me charges $200+/pax for the same service. Lead capture is live and measuring demand.
Flip to paid (Stripe Payment Link on owner-accepted leads, human-fulfilled) only when
`hop_escalations` shows ≥5 qualified leads/month. Human-gated by construction; scale later, if
ever, via the checkout seam.

### 3.5 Engine-as-a-layer — MCP metering + B2B2C (the real prize)
Free 25 calls/day/token → Pro 1,000/day (B2 epic; `getUserTier` is one import away from
`withMcpAuth`). Separately: one warm issuer/fintech/credit-union conversation with the MCP demo
(R3.4). One signed API partner at even $2–5k/mo dominates every consumer stream. The Claude
connectors directory (~343 connectors, usage-ranked, travel category actively promoted) is a
free distribution wedge nobody in award-search occupies with *stateful* balances (R2.1).

## 4. Cost structure & unit economics (approximate, marked)

**Fixed burn today** (~$50–100/mo): Vercel Pro $20 · Neon $0–19 · Resend $0 (3k emails/mo free,
$20/mo at 50k) · Upstash/PostHog/Cloudflare free tiers · seats.aero Pro $9.99 (personal tier —
**won't-buy commercial**, 2026-08-21; gate ④ is now take this off the paid path, not upgrade
it) · domain ≈ $1.
**Variable**: Duffel $3 + 1%/confirmed order (+$0.005/search beyond 1,500:1 look-to-book) —
only when native checkout ever goes live; concierge LLM ≈ $0.02–0.03/turn uncached on Sonnet-class
models, well under $0.01 with prompt caching (cap free usage via existing rate limits);
Stripe ≈ 2.9% + 30¢.

**Margins**: Pro sub $49 → ~$47 net of Stripe → COGS <$5/user/yr (shared cron sweeps, email in
free tier) → **~85–90% contribution margin**. Card approval: ~100% margin. Escalation: $149 −
1–2h owner time.

**Break-even (fixed burn)**: ~15–25 Pro subs, **or** ~6–12 card approvals/yr, **or** any B2B
pilot. hop can be default-alive on trivially small numbers — the constraint is distribution and
licensing, not cost.

## 5. Financial scenarios (12-month, honest)

| Scenario | Assumptions | Revenue (yr) | Verdict |
|---|---|---|---|
| Floor | SEO/community only, ~300 registered, 15 Pro, occasional affiliate | ~$1k | Break-even side project; engine keeps compounding |
| Base | Receipts + newsletter + connectors work; 1.5–3k registered, ~75 Pro, 1–2 card approvals/mo, 2 escalations/mo | ~$10–12k | Profitable side business, credible growth story |
| Upside | Base + one B2B2C pilot at $2–5k/mo | $30–70k | A real company; consumer surface becomes the demo |

Plain statement: **consumer subscriptions alone make hop a profitable side business, not a
company. The company-scale path is the agent/B2B2C engine layer.** Month-6 checkpoint: if no
B2B conversation has advanced and Base isn't tracking, hop runs as a default-alive product
(costs covered, engine compounding) rather than chasing paid acquisition.

**North star** (unchanged from the roadmap): weekly active searchers. **90-day bar: 100 WAS and
one real dollar attributed end-to-end.** Supporting KPIs, all from R0.5 events + ledgers:
activation (sign-up → first program → first verdict), watches created / alerts fired / alert
CTR, receipts created/shared, cash + card outclicks, MRR, MCP tokens active.

## 6. Go-to-market (sequenced, mostly $0)

1. **Fix the funnel before filling it** (Phase 1): the aha — a no-auth live verdict — exists
   and is hidden. R1.1–R1.4 repair activation; nothing else matters until then.
2. **Community seeding** (owner, weekly): 10–15 genuinely-helpful "here's the actual math"
   receipt replies in r/awardtravel + FlyerTalk once R1.5 ships. This audience's tools all grew
   this way.
3. **SEO mesh** (already built: 21 sweet-spot + 33 destination pages): add the eight program
   guides (R2.4) — the realistic organic wedge; measure via GSC.
4. **Agent channel**: public `/mcp` page + MCP registry + Claude connectors + ChatGPT Apps
   submissions (R2.1); listing copy leads with stateful-vs-stateless.
5. **Newsletter** (R1.6) catches traffic that won't sign up; weekly digest is the retention loop
   (R2.3).
6. **Press/roundups** (R3.5): Frequent Miler / OMAAT / NerdWallet comparison authors — gated on
   R0.1 (math correct) and R2.6 (demo fixtures don't embarrass).
7. **B2B2C**: one warm conversation (R3.4). Not a pipeline — one good demo.
8. **Explicit non-spend**: no paid acquisition until the five funnel events exist and activation
   >40%; no affiliate-blog payola; no feature-for-coverage trades.

## 7. Execution roadmap

**Backbone**: R0.1–R3.5 exactly as specced in `2026-07-03-critical-review-roadmap.md` (Phase 0
stop-the-bleeding → Phase 1 fix-the-funnel → Phase 2 earn-attention → Phase 3 prove-the-business),
plus the kill/freeze list and owner-action pack. As of 2026-07-04 **all R-items are open**; the
only movement since is design polish and thread memory.

**Business-layer additions (this plan):**

| Epic | What | Files (indicative) | Done means |
|---|---|---|---|
| **B1 — Public pricing surface** | `/pricing` page: Free vs Pro ($49/yr early price, grandfather line), FAQ, JSON-LD; nav + `/account#billing` link to it. Ships dark behind `isBillingEnabled()` | `app/pricing/page.tsx` (new), `components/BillingSection.tsx`, `lib/env.ts` (no new keys) | Page renders both tiers with engine-interpolated caps (`ALERT_LIMITS`), no hardcoded "3"; renders nothing user-reachable when billing off |
| **B2 — MCP quota tiers** | Durable per-token daily quota: free 25/day, Pro 1,000/day; 429 with terse upgrade copy; `getUserTier` read at auth resolve | `lib/mcp-usage.ts`, `lib/api-tokens.ts`, `app/api/[transport]/route.ts` | Quota survives process restarts (counts from `hop_mcp_usage`), degrades open on DB failure (never blocks on `{ok:false}`), tests for boundary + degraded paths |
| **B3 — Unit-economics panel** | Extend the admin weekly digest with money: MRR (Stripe), outclicks by kind, escalation pipeline, LLM cost (PostHog), infra-cost constant → contribution line | `lib/business-digest.ts`, `components/admin/AdminDashboard.tsx` | Owner sees revenue vs cost weekly without leaving `/admin`; every number computed from ledgers/APIs |
| **B4 — Ops runbook + env truth** | `.env.example` gains every billing/alerts key; `docs/ops-runbook.md`: exact Vercel/Stripe/Resend/DKIM/cron flip order (R0.4's checklist, made durable) | `.env.example`, `docs/ops-runbook.md` (new) | An operator (human or agent) can take billing from dark to live using only the runbook |

**Sequencing gates (hard, checked before the phase starts):**

- Flip `HOP_ENABLE_BILLING` → gates ①–④ in §3.1.
- Start any growth experiment → R0.5 events live.
- Any press/reviewer outreach → R0.1 + R2.6.
- Extend `eve/`, memory axes, hotels, `/compare` pages → frozen per the kill/freeze list until
  Phase 3 revenue data exists.

**Owner actions (calendar, not code — start immediately, latency is the timeline):**
seats.aero commercial-terms email (gates billing) · CJ/Impact affiliate applications ·
Resend DKIM for hop.flights (gates every alert) · trademark consult on "hop" + bunny
(class 39/42) + register @hopflights handles · AwardWallet partner API formal ask (a written
"no" is strategic information).

## 8. Files to touch (this doc's own diff)

| Path | Change | New? |
|---|---|---|
| `docs/plans/2026-07-04-business-plan.md` | this document | yes |
| `AGENTS.md` | "What to build next" pointer → this plan + Linear | no |
| `docs/README.md` | index row for this plan | no |
| `CLAUDE.md` | one line: business plan = sequencing source of truth | no |

B1–B4 and R-items carry their own files-to-touch in their issues/specs; this program doc adds no
application code.

## 9. Engine hooks, flags, degradation, tests (program-level constraints)

- **Engine hooks**: every number on every monetization surface is engine-computed —
  `getUserTier`, `countActiveStandingOrders`, `ALERT_LIMITS[tier]`, `hop_outclicks` /
  `hop_mcp_usage` aggregates, Stripe API reads. Prices are configuration paired to Stripe Price
  objects, displayed verbatim. **No LLM ever produces a price, cpp, quota, or revenue figure.**
  No MCP/concierge/Eve tool gains billing capability.
- **Flags & seams**: `isBillingEnabled()` (double-locked: flag + 3 Stripe keys) gates every
  billing surface incl. B1; B2 quotas activate only when billing is on (free-for-all until
  then); all new env keys via `lib/env.ts` lazy accessors; payments never touch the live Duffel
  key; money movement is always a user-clicked Stripe-hosted page.
- **Degradation**: DB reads through `withDb` fallbacks (`getUserTier`→`'free'`, quota
  check→allow, digest panels→dim). The single deliberate exception stands: a failed
  webhook tier-write returns 500 so Stripe retries. All tables `user_id`-scoped in code.
- **Test plan**: each epic ships vitest cases per its spec; the program-level bar is
  `npm run check` + `npm run build` green, plus the R0.2 end-to-end proof: **one real $
  test-mode purchase that lands premium via the webhook**. Boundary cases named: cap at exactly
  `ALERT_LIMITS.free`, quota at exactly 25/1,000, webhook replay/out-of-order, degraded DB on
  every money read.
- **Copy** (`docs/design/copy-spec.md`): state the number ("$49/yr — early price, yours for
  life"), no urgency mechanics, no slop, no bunny on money surfaces.

## 10. Risks & kill criteria

| Risk | Exposure | Mitigation / kill criterion |
|---|---|---|
| seats.aero license (landlord is a competitor) | Award feed = the product | **Won't-buy** (2026-08-21). Gate ④ = Partner API off the paid path. Chart-cpp then first-party live search (`2026-08-21-replace-seatsaero.md`). Kill paid award features if FD-charts never ships; do not turn the unlicensed feed back on |
| Multi-pax cpp bug | "Trust our math" brand | R0.1 before anything ships; it outranks every feature |
| Card-affiliate approval latency | Highest-$ stream | Apply now; judge by outclick baseline; if no network approval in 2 quarters, deprioritize the stream (don't fake it with placeholder links) |
| Hopper trademark (category+animal overlap) | Brand | 1-hour counsel consult; disambiguation FAQ shipped; distinct trade dress held |
| AwardWallet could ship verdicts; Gondola could pivot to flights | Consumer moat | Speed + balances + observed-cpp telemetry; quarterly competitive check is already specced |
| Doc/scope sprawl outpacing traction (~35 open workstreams) | Execution | This plan + Linear is the single queue; kill/freeze list enforced; new plans need a phase slot |
| Solo-owner bus factor | Ops | B4 runbook; agents can operate everything except owner-action items |

## 11. How an LLM agent picks this up (the protocol)

1. Read `CLAUDE.md`, `AGENTS.md`, then this doc.
2. Open Linear project **hop** (team `n3wth`). Pick the highest-priority open issue in the
   lowest open phase milestone (`R0.x` before `R1.x` …; `B#` epics carry their phase in the
   issue). Respect `blockedBy` relations and the §7 gates.
3. Each issue body contains its continuation prompt — paste-ready context, evidence file:lines,
   and acceptance criteria. Follow the compound loop: `/plan` (if the item lacks a spec) → work
   → `/review-parallel` → `/compound`. Verify with all four: `tsc --noEmit`, lint, test, build.
4. Move the Linear issue as you go (In Progress → Done, or comment the blocker); reference the
   issue id in the PR.
5. Never: generate an economic number, throw from a `lib/*` client, ship an ungated seam, touch
   the live Duffel key, or start a frozen item (eve/, hotels, memory axes, /compare).

Items marked **owner** (§7) are human-only: real-world accounts, legal, partnerships. Flag them
in a PR comment or the weekly digest rather than attempting them.

## 12. Review hooks & compound step

- This diff (docs only): no reviewers required beyond doc-accuracy; the epics it spawns name
  theirs (B1 copy-voice+nextjs16; B2 security+degradation+engine-invariant; B3
  engine-invariant+degradation; B4 security for secret-handling hygiene).
- Compound: when Phase 0 lands, re-run the six-lens review per the roadmap's Part 3 and append
  a dated addendum here with actuals vs the §5 scenarios. When billing flips, capture the
  deploy-order lessons into `docs/solutions/`.

---

## 13. Addendum — 2026-08-20 (actuals vs §5; sequencing moved)

Phase 0 code is on `main`. Verified revenue is still $0. hop.flights traffic is ~10–14
visitors/week with zero confirmed-`Regular` conversion since instrumentation shipped
(2026-07-05). The north-star "$10k MRR in 30 days" window closed 2026-08-05 without a launch
being executed. B1–B4 from §7 are largely shipped; the remaining bind is distribution, seats.aero
**off the paid path** (R3.1 / N-320 **won't-buy** 2026-08-21; N-386 re-specified as
chart-cpp replacement — `docs/plans/2026-08-21-replace-seatsaero.md`), and founder-gated
PRs — not missing Stripe/pricing/quota code.

**Sequencing for the next 90 days lives in
`docs/plans/2026-08-20-path-to-first-dollar.md`.** Award-data replacement lives in
`docs/plans/2026-08-21-replace-seatsaero.md` (ADR 0014). This file still owns positioning,
pricing ($49/yr), the five streams, the four §3.1 billing gates (gate ④ as amended), and
the Floor/Base/Upside scenario shapes. Do not re-derive those. Do not treat the expired
$10k target as a desk goal.

Against §5: the Floor (~$1k/yr, break-even side project) is the honest *consumer* near-term
readout if a launch actually happens — not the 90-day company goal. Base and Upside have not
started, because the distribution events they assume never ran. The agent/B2B layer (Upside)
runs **in parallel** per the 2026-08-20 addendum (MCP listing + one R3.4 conversation), not
after Floor. The month-6 checkpoint (~2026-12-04) still stands.
