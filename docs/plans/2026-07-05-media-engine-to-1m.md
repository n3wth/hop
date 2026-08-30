# 2026-07-05 — The media engine: hop's audience layer, and the honest path toward $1M/month

> Plan. Status: **adopted ambition layer** on top of `2026-07-04-business-plan.md`.
> TL;DR: the business plan's own ceiling is a profitable side business (§5: $10–70k/yr). The
> owner's target is $1M+/month. No consumer SaaS in this category gets there on subscriptions
> alone — but audience-first businesses (Lenny's Newsletter, Every.to) show the shape that does:
> **an owned audience compounding through consistently-valuable content, monetized four ways at
> once (subscriptions, sponsorships, affiliates/bundles, B2B products spun from the same
> engine).** hop's unfair advantage: its content can carry computed numbers nobody else has.
> This plan adds the M-series epics and mirrors them into Linear so LLM agents can execute
> everything that isn't owner-only.

**Relation to other docs**: the 2026-07-04 business plan remains the operating plan and its
gates all stand (billing gates, kill/freeze list, engine invariants). This plan does not
re-sequence Phase 0–1 — funnel repair still comes first. It defines what Phases 2–4 scale
*into*, and replaces the business plan's §5 "Upside" ceiling with an explicit media-engine
growth model. Where an M-item extends an R-item (receipts, newsletter, digest, guides), the
M-issue says so and blocks on it.

## 1. Why Lenny's / Every.to are the right references (and what actually transfers)

- **Lenny's Newsletter** (~1 signal): one person → free newsletter → paid newsletter →
  **bundle** (pay for Lenny's, get $15k+ of product-tool subscriptions) → community → job board
  → podcast with sponsors. The bundle inverted acquisition: tools *pay to be distribution* for
  the audience. Revenue is subscription-heavy, sponsor-topped.
- **Every.to** (~2 signal): small team → daily essays → subscription bundle that includes
  **software they built for themselves** (Spiral, Sparkle, Cora) → consulting/training on top.
  Content is the R&D lab and the distribution for the products.
- **What transfers to hop**: (1) the audience is the asset — everything else rents it;
  (2) content + product must share one engine so each makes the other better; (3) monetize the
  same reader 3–4 ways without degrading trust; (4) small-team economics: automation-first,
  which for hop means **LLM agents produce the content pipeline, the engine produces every
  number, the owner produces judgment and relationships**.
- **What does NOT transfer**: their categories tolerate opinion. hop's category punishes it —
  points bloggers are distrusted *because* affiliate money shapes their advice. hop's
  counter-position: **every claim carries an engine-computed number, and affiliate placement
  never reorders a verdict** (same invariant that already governs the product).

## 2. The honest math ($1M/month ≈ $12M ARR)

Illustrative steady-state mix — targets, not forecasts; every line has a named engine:

| Stream | Target | Monthly | Driven by |
|---|---|---|---|
| hop Pro / premium newsletter (one sub) | 30k subs @ ~$12.5/mo avg | ~$375k | M3 newsletter product + R-series retention |
| Card affiliates | ~1,500 approvals @ ~$150 | ~$225k | M2 SEO mesh + M1 content OS + §3.2 network approval |
| B2B / API (self-serve + enterprise) | ~15 partners avg $10k | ~$150k | M8 productized API on B2/R3.4 |
| Sponsorships (newsletter + placements) | ~8 slots @ $10–15k | ~$100k | M6 sponsor kit; needs 200k+ engaged subs |
| Bundle / partnership rev-share | — | ~$100k | M7, Lenny's-bundle mechanics |
| Concierge + marketplace | — | ~$50k | §3.4 scaled via checkout seam |

Prerequisite for the top four lines: roughly **300k–1M owned audience** (email + MCP tokens +
registered users) and ~1–2M monthly organic sessions. That is the media engine's entire job,
and it is a 24–36 month build, not a quarter. The checkpoint cadence (§6) exists so we find
out fast if the curve isn't bending.

## 3. The M-series epics

Every epic: flag-gated, engine-computed numbers only, copy-spec voice, `withDb` degradation,
FTC-compliant disclosure where money is involved. **LLM-pickable unless marked owner.**

| Epic | What | Extends | Done means |
|---|---|---|---|
| **M1 — Content OS** | The pipeline that turns engine data into published, reviewed content: data pull (valuations, transfers, sweet spots, seasonality) → draft → copy-voice + engine-invariant review → `/guides` publish with JSON-LD → weekly refresh cron marks stale numbers. | R2.4's 8 guides become its first output | An agent can take a topic from queue to published page with zero owner input; every number traces to a `lib/*` call; stale-data check runs weekly |
| **M2 — Programmatic SEO scale-out** | From 54 pages to thousands: route-level verdict pages (top ~2k routes, `force-static`, weekly ISR), card→program transfer pages, per-program "what a point is worth this week" pages fed by live valuations once ≥20-sample gate passes. Internal-link mesh + sitemap partitioning. | sweet-spots, /points bands, seo-routes | GSC-verified indexation curve; zero LLM-generated numbers; pages render honestly when data is missing (no fabricated cpp) |
| **M3 — Newsletter as product** | One subscription, two tiers: free weekly computed digest (grows the list), Pro daily/instant deal alerts (the paid retention loop). Referral loop, share-to-web archive pages (SEO), Resend broadcast infra + audience sync. | R1.6 capture, R2.3 digest | List growth + open/CTR measured in PostHog; archive pages indexed; paid tier gated by `isBillingEnabled()` |
| **M4 — Receipts as the social object** | Verdict receipts designed to be screenshot: OG cards with the math on them, one-tap share, `/v/[id]` pages that convert viewers to searchers. The organic loop every points-Twitter thread feeds. | R1.5 | Receipt → visit → search funnel measured; receipts appear in the wild without owner posting |
| **M5 — Distribution automation** | Agents draft, owner publishes: weekly Reddit/FlyerTalk "here's the actual math" reply queue (drawn from real search data), YouTube/TikTok short scripts from the week's best verdicts, podcast/interview one-pager. Platform-authentic — no astroturf, no auto-posting. | GTM §6.2 | A weekly distribution pack lands in /admin; owner spends ≤1h/wk publishing it |
| **M6 — Sponsor kit + ad surface** *(owner-gated sales)* | Audience dashboard with real numbers (subs, opens, sessions — computed from Resend/PostHog/GSC), rate card, one clearly-labeled newsletter sponsor slot + one site placement, flag-gated, FTC-compliant. Agents build the surface; owner sells. | B3 panel | Sponsor slot renders only when a sponsorship row exists; disclosure copy passes review; dashboard numbers match sources |
| **M7 — The hop bundle** *(owner)* | Lenny's-bundle mechanics inverted for travel: hop Pro bundled with complementary paid tools (lounge, ESTA/visa, luggage-tracking, award-history tools) — partners trade product for hop's audience. Start as one-pager + 3 outreach emails; build redemption flow only on a signed yes. | §3.1 pricing | First signed partner; bundle page ships dark until then |
| **M8 — API as self-serve product** | Productize the MCP/engine layer: public docs page, self-serve keys, Stripe metered billing ($99/$499/$999 tiers + enterprise CTA), quota from B2's rail, one-command onboarding for agent devs. | B2 quotas, R2.1, R3.4 | A stranger can go from landing → paid key → first verdict call without a human; usage + revenue in B3 panel |
| **M9 — Media KPI panel** | The scoreboard for all of the above inside /admin: list size/growth, open/CTR, organic sessions & indexation, receipt shares, affiliate EPC + outclicks, sponsor sell-through, API MRR — every number pulled from its system of record. | B3 | Owner reads one panel weekly; every figure computed, none hand-entered |
| **M10 — Community** | **Hold.** Lenny's community works because the newsletter earned it. Revisit at 25k free subs; a ghost-town Discord is negative signal. | — | Explicitly deferred; issue exists so nobody freelances one |

**Sequencing**: M1/M2/M4 can start once Phase 1 funnel items are done (they compound slowly —
start early). M3 paid tier and M6/M8 monetization respect the business plan's billing gates.
M5 begins when there is a weekly stream of real search data worth publishing. M7 is owner
calendar time. Nothing in the M-series may jump the R0.x correctness queue.

## 4. Invariants for content at scale (non-negotiable)

1. **No LLM-generated numbers, ever, anywhere** — content pages call the same `lib/*` engines
   the product does; prose explains computed values. A page that can't compute its number
   renders honesty ("not enough data"), not a guess.
2. **Affiliate money never reorders advice.** Rankings/verdicts come from the engine; affiliate
   links attach to whatever the engine already chose. Disclosure on every monetized surface.
3. **Copy-spec voice at 10x volume** — the copy-voice reviewer gates every published piece;
   scale never excuses slop. The bunny stays a logo, not a mascot-blogger.
4. **Owner does judgment and relationships** (sponsor sales, partner deals, community posting
   under his name); agents do everything else. No auto-posting to third-party platforms.

## 5. Files this plan touches

| Path | Change | New? |
|---|---|---|
| `docs/plans/2026-07-05-media-engine-to-1m.md` | this document | yes |
| `docs/README.md` | index row | no |
| `AGENTS.md` §What-to-build-next | one line: media-engine plan = the ambition layer above the business plan | no |

M-epics carry their own files-to-touch in their Linear issues. This doc adds no application code.

## 6. Checkpoints & kill criteria

- **Monthly**: M9 panel review — list growth rate, organic curve, affiliate EPC. Flat curve for
  2 consecutive months on any M-stream → that stream's next issue gets re-scoped or killed,
  in this doc, dated.
- **The §5 business-plan month-6 checkpoint stands.** The media engine changes the ceiling,
  not the discipline: if Base isn't tracking, hop runs default-alive and the M-series continues
  only where it costs ~$0 (M1/M2 compound without spend).
- **Kill criteria carried over**: seats.aero terms still block billing; card-network approval
  latency still judges §3.2; frozen items stay frozen.

## 7. Linear mirror

Every M-epic above exists as a Linear issue in team `n3wth`, project `hop` (`M#` title prefix),
each with a continuation prompt, acceptance criteria, and blockedBy relations to the R/B items
it extends. Owner-only work inside an epic is flagged **owner** in the issue body per §11 of
the business plan.
