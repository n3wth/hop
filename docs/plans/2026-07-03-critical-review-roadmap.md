# Critical review & sequenced roadmap — 2026-07-03

> Status: **proposed operating roadmap** — supersedes the *sequencing* in
> `2026-06-29-expansion-roadmap.md`; the individual plan docs remain the implementation specs.
> How this was produced: six independent review lenses (value prop/moat with external research,
> design, user journeys, implementation, growth/monetization, and a strategy-doc synthesis) run
> against the code at `6078a7e`, with every load-bearing claim re-verified at file:line before
> landing here. Each roadmap item carries a **continuation prompt** — paste it into a fresh
> Claude Code session to pick the work up with zero re-discovery.

## TL;DR

The engine is real and the business is not yet. hop's verdict engine survives adversarial review
(always-resolves invariant holds at every edge attacked; 809/809 tests green; security posture
above par for a solo shop), and the honesty architecture — computed numbers, ownership-voice
gating, degradation notes — is the best thing about the product. But: the core money math is
wrong for every multi-passenger search; the Stripe path charges a customer and leaves them on
the free tier forever; the funnel buries the moat behind a chat composer and dead-ends motivated
users; six ops flags that constitute the "moat under construction" (valuation sync, self-improve,
standing-order alerts) are dark in production; there are zero product analytics; and the repo is
accumulating drift (dead money code, a design canon that misdescribes the code, ~35 open
workstreams) faster than it accumulates users. All three data legs are rented, and the most
important landlord (seats.aero) is also a competitor whose published API terms prohibit
commercial use without a written agreement we have no record of holding.

None of this is fatal. Nearly all of it is one-to-five-day fixes that are already specced in this
repo's own plans. The roadmap below is mostly *sequencing and wiring*, not invention.

---

## Part 1 — the honest assessment

### What is genuinely strong (protect these)

- **The engine and its invariants.** `assembleSearch` cannot reject: 10s AbortController
  timeouts on all three upstream clients, `res.json()` inside try, no-throw cache,
  fire-and-forget telemetry. CI (`.github/workflows/ci.yml`) runs `npm run check` + `next build`
  per PR and passes clean.
- **The no-auth real search.** A cold visitor can run a live search and get a computed verdict
  without an account (`app/search/page.tsx:242-277`). This is the aha moment — it exists, it
  works, and it is currently hidden.
- **The concierge's grounding discipline.** Engine-only numbers, server-reconciled card
  economics, ownership-voice gating, rate limits + BotID (`app/api/concierge/route.ts:370-389,852`).
- **Trust hygiene.** Hashed `hop_` tokens (SHA-256 over 256-bit entropy is correct), in-code
  `user_id` scoping that fails closed on unknown columns, admin gated by owner + verified email,
  no secrets reachable from client components.
- **The verdict surface's design.** The teal hero → boarding pass → ranked alternatives sequence
  is scannable in ~2s and a `/search` screenshot is recognizably hop.
- **The docs system itself.** The value-prop audit and competitive-positioning docs are candid
  and largely *more correct than the code that landed after them*.

### The six structural problems

**1. "Trust our math" is the brand, and the math has a known, unfixed hole.**
`lib/duffel.ts:87-91` prices the whole party (N passengers); `lib/seatsaero.ts` never reads
`adults` — awards are per-seat; `lib/search.ts:161-166` divides one by the other. Every live
multi-passenger search inflates cpp by roughly the party size and can flip the verdict to
"use points" incorrectly. Documented as P1 in the 2026-07-02 audit, deliberately deferred, still
open — while nine same-day expansion plans landed. The single highest-leverage engineering task
in the repo.

**2. The money path cannot take money.**
Two Stripe stacks shipped in parallel and don't compose: checkout
(`app/api/billing/checkout/route.ts` → `lib/stripe.ts#createCheckoutSession:68-70`) sets
`metadata.user_id` but never creates/attaches a `hop_customers` row; the live webhook
(`app/api/webhooks/route.ts:89-100`) attributes *only* via `hop_customers` lookup and **throws**
("Customer not found") for any session the real checkout minted → 500 → Stripe retries → gives
up → `getUserTier` reads no row → customer paid, stays `free`. Meanwhile the designed-and-tested
layer (`lib/billing.ts`) has zero importers — the tested code is dead and the live code is
untested — and the orphaned second surface (`components/SubscriptionPaywall.tsx`, mounted
nowhere) fronts `app/api/subscriptions/create/route.ts`, reachable by bare GET with no
`isBillingEnabled()` gate, no rate limit, no BotID. The "trivial" Phase-1 wire (Kiwi affiliate
attribution) rests entirely on one client-side Travelpayouts script (`app/layout.tsx:161`) that
has never been verified and has no first-party ledger to reconcile against.

**3. The funnel inverts the product.**
The hero's primary action routes into `/ask` chat; the reconciling sample verdict is two
scroll-sections down; the working no-auth `/search` is a small text link (`app/page.tsx:147-163`).
Activation dead-ends: a **signed-in** user with zero programs on a points-winning verdict is told
"Sign in to see if your miles win" (`components/VerdictRail.tsx:81` — `owns = usingPoints &&
hasRealBalances`, ignores `isSignedIn`; CTA at `:209`), and the login bounce drops their search.
Both import paths are unavailable (AwardWallet connect degrades without `AWARDWALLET_CONNECT_URL`;
Gmail double-gated off), so activation = manual data entry requiring external lookups. The core
loop's happy ending for a points win is an airline **homepage** (`lib/booking.ts:7-33`; unmapped
programs → literally Google Flights) where the user re-keys everything. Estimated sign-up →
personalized-verdict survival: ~20-30%.

**4. The founder is flying blind.**
Zero product-event analytics: no posthog-js, no `track()` calls anywhere — only anonymous page
views and LLM-cost spans. Sign-up, first program, first search, verdict, outclick: all
unmeasured. Degradation detection is well built and **dark** (`HOP_ENABLE_SELF_IMPROVE` off →
`recordDegradation` returns at `lib/degradation-telemetry.ts:35`, sentinel 503s). The public
trust page argues against us ("0 of 44 programs live-verified") because `HOP_ENABLE_VALUATION_SYNC`
is off and the worker undeployed. "Watch this route" promises "hop pings you"
(`WatchThisRoute.tsx:87-89`) while the cron 503s until `STANDING_ORDERS_CRON_ENABLED` flips and
email needs a DKIM-verified domain. The moat the docs describe is largely *switched off*.

**5. Sprawl and drift are outpacing traction.**
~45-50 distinct workstreams proposed across 17 docs in a ~5-day-old repo; ~35 open. Dead code
with passing tests (`lib/billing.ts`), dead seams (`PARALLEL_API_KEY`, `AUTONOMA_*`,
`FIRECRAWL_API_KEY` accessors with zero consumers), a dead parser (`lib/prefs-parser.ts`), three
dark memory axes, an undeployed agent runtime (`eve/`, 661 lines, wrong env names in its README)
with a standing reviewer + skill inviting more of it. The anti-drift system is itself drifting:
`docs/design/DESIGN-SYSTEM.md` misdescribes tokens/easing/motion that shipped, the ADR index
omits accepted ADR 0007, plans still say "Auth0," and the 2026-06-28 plan is marked "active"
while describing a single-user no-auth product. Six cron routes fail **open** when `CRON_SECRET`
is unset (`if (!secret) return true`), `/api/search` fans out to two paid APIs with no rate
limit, and its fallback dates are hardcoded to `2026-07-09/12` (`app/api/search/route.ts:36-37`)
— stale in under a week.

**6. All three data legs are rented; one landlord is a competitor.**
seats.aero's published terms prohibit commercial API use without written permission, and it
ships its own ChatGPT integration, MCP server, and AI assistant. No ADR or plan records a
commercial agreement. The "real balances" leg is, for real users, manual entry (AwardWallet
partner approval "unlikely to land" per ADR 0005) — the same manual wallet point.me/PointsYeah/
Daily Drop already offer. The observed-valuation data moat is honest-but-inert (flag off, worker
undeployed, ≥20-samples-per-program gate that pre-traction traffic won't clear). The cpp formula
itself is one line; the durable assets available to *this* founder are the booking loop +
booked-at-what-cpp history, reliable proactive alerts, and an issuer/fintech embed of the engine
(the Bilt→Points Path swap and Capital One internalizing Hopper's portal prove buyers exist).

### Lens verdicts in one line each

- **Value prop/moat:** genuinely unique claim today, but all three legs rented and the segment is
  small; the defensible version is engine-as-embeddable-layer + proactive delivery, not more
  consumer surfaces.
- **User journeys:** the funnel, not the product, is the problem — the aha exists and is hidden.
- **Design:** `/search` is near national-grade; the system beneath it is aspirational (913
  arbitrary `text-[Npx]` values vs a 13-step scale used in 17 files; canon doc lies; on-teal
  labels ≈3.3:1 contrast on the flagship surface).
- **Implementation:** core invariants hold, gate is real; the P1s are money-path wiring, dark
  telemetry, and fail-open crons — days, not weeks.
- **Growth/monetization:** deep product moat, shallow business layer; nothing shipped can acquire
  a stranger or measure one; the existing plans are good and mostly unwired.
- **Strategy docs:** decided architecture is sound; sequencing discipline collapsed on 07-02
  (ten plans in one day, P1 left open beneath them).

---

## Part 2 — the roadmap

### Operating principles (the "no" list)

1. **Verdict correctness outranks every new surface.** Nothing ships ahead of a known
   wrong-number bug.
2. **One money lane.** Exactly one checkout → webhook → tier path, tested end-to-end, before the
   billing flag ever flips.
3. **Flip before build.** Six shipped seams are dark; turning them on beats writing seam #7.
4. **Measure before optimize.** No growth experiment before the five core events exist.
5. **Category discipline** (per the competitive doc): hop is the points-vs-cash verdict engine,
   not an AI travel planner. Planners are channel, not competition.

### Phase 0 — stop the bleeding (week 1)

**R0.1 — Fix multi-passenger cpp (the held-over P1).** Scale award miles/taxes by seat count (or
compare per-seat cash) so cpp compares like-for-like; label per-person economics in the UI; add
engine tests for `adults > 1`. Evidence: `lib/search.ts:161-166`, `lib/duffel.ts:87-91`,
`lib/seatsaero.ts` (no `adults` reference). Effort: ~1 day incl. tests.
> **Prompt:** In hop, fix the multi-passenger cpp mismatch documented as P1 in
> docs/plans/2026-07-02-value-prop-audit.md: Duffel cash totals are party-summed
> (lib/duffel.ts:87-91) while Seats.aero miles/taxes are per-seat (lib/seatsaero.ts never reads
> adults), so lib/search.ts:161-166 inflates cpp by ~party size. Decide per-seat vs per-party
> comparison basis, implement it in lib/search.ts, surface a "per person" label in
> VerdictRail/ResultRow where party > 1, add vitest cases for adults=2/4 with mixed
> award/cash options, and run the engine-invariant-reviewer agent over the diff.

**R0.2 — One Stripe lane, end-to-end.** Make checkout resolve-or-create the `hop_customers` row
(reuse `getOrCreateCustomer`) and/or make the webhook fall back to `metadata.user_id`; route the
webhook through the tested `lib/billing.ts` mapping (or delete that module deliberately); make
the webhook soft-fail instead of throwing (`app/api/webhooks/route.ts:100`); gate it with
`isBillingEnabled()`; **delete** `components/SubscriptionPaywall.tsx` + `app/api/subscriptions/*`
(unmounted, ungated, GET-reachable); add a webhook→tier test; finish with one real $9.99 test
purchase. Effort: ~1 day.
> **Prompt:** In hop, unify the two Stripe stacks into one tested lane. Today
> lib/stripe.ts#createCheckoutSession sets metadata.user_id but never creates a hop_customers
> row, while app/api/webhooks/route.ts:89-100 attributes only via hop_customers and throws
> "Customer not found" — so a paying customer stays free forever. Fix attribution (create the
> customer row at checkout AND read metadata.user_id as webhook fallback), route event→tier
> mapping through lib/billing.ts so its tests guard the live path, replace the throw with a
> logged soft-fail, add isBillingEnabled() gating, delete components/SubscriptionPaywall.tsx and
> app/api/subscriptions/* as dead/ungated code, and add a webhook→tier vitest. See
> docs/plans/2026-07-03-critical-review-roadmap.md R0.2.

**R0.3 — Hardening trio.** (a) Crons fail closed in production:
`if (!secret) return process.env.NODE_ENV !== 'production'` across all six routes; (b) add
`checkRateLimit` to `/api/search` (BotID alone doesn't stop cost amplification against two paid
upstreams); (c) copy the page's date clamp into `app/api/search/route.ts` — the hardcoded
`2026-07-09/12` defaults go permanently stale this week. Effort: ~2 hours.
> **Prompt:** In hop, apply three hardening fixes from
> docs/plans/2026-07-03-critical-review-roadmap.md R0.3: make all six app/api/cron/* routes fail
> closed in production when CRON_SECRET is unset (currently `if (!secret) return true`), add the
> existing lib/rate-limit checkRateLimit to app/api/search/route.ts, and replace its hardcoded
> depart/return defaults (2026-07-09/12) with the same rolling-date clamp app/search/page.tsx
> uses. Add tests where cheap; run the security-reviewer agent over the diff.

**R0.4 — Turn the lights on (ops checklist, zero code).** In Vercel prod: set
`HOP_ENABLE_SELF_IMPROVE=1`; deploy `cloudflare/valuations-worker/` and set
`HOP_ENABLE_VALUATION_SYNC=1`; set `STANDING_ORDERS_CRON_ENABLED=1`; confirm `CRON_SECRET`,
`RESEND_API_KEY`, explicit `BETTER_AUTH_SECRET` (don't rely on the DATABASE_URL-derived
fallback, `lib/env.ts:185-204`); verify `hop.flights` DKIM in Resend. `/admin` already surfaces
`selfImproveEnabled` to confirm. Owner-only; ~1 hour + DNS wait.

**R0.5 — Instrument the five events.** posthog-js (key already present in `instrumentation.ts`)
with `identify(user.id)`: `signed_up`, `first_program_added`, `search_ran`, `verdict_viewed`,
`outclick` (cash + card, server-side from the ledger). Effort: ~half a day.
> **Prompt:** In hop, add product-event analytics per
> docs/plans/2026-07-03-critical-review-roadmap.md R0.5: wire posthog-js (NEXT_PUBLIC key
> pattern via lib/env.ts, lazy + graceful when unset), identify by Better Auth user.id, and emit
> exactly five events — signed_up, first_program_added, search_ran, verdict_viewed, outclick —
> the last also as a server event alongside lib/outclicks.ts inserts so revenue clicks join the
> funnel. No LLM-side changes; keep it flag/env-gated and degradation-safe.

**R0.6 — Make cash revenue reconcilable.** Verify in prod devtools that the Travelpayouts tag
actually decorates Kiwi outclicks; route cash CTAs through a first-party `/api/go/kiwi` redirect
(clone the `/api/go/card` pattern) so there's a ledger to reconcile commissions against.
Effort: ~half a day.
> **Prompt:** In hop, add a first-party cash-outclick ledger per
> docs/plans/2026-07-03-critical-review-roadmap.md R0.6: create app/api/go/kiwi following the
> app/api/go/card/[id] pattern, extend lib/outclicks.ts with kind='cash', point cash CTAs
> (lib/booking.ts consumers) through it, and keep the Travelpayouts client tag as-is. Include
> the redirect in the outclick PostHog event from R0.5 if that shipped.

**R0.7 — Two highest-consequence test files.** `lib/accounts.ts` merge/de-dupe semantics (the
single balance resolver every surface trusts — currently untested) and the webhook→tier mapping
(part of R0.2). Effort: ~half a day.

### Phase 1 — fix the funnel (weeks 2–4)

**R1.1 — Repair the activation bridge.** When `isSignedIn && !hasRealBalances`, the verdict CTA
becomes "Add your programs to check your miles" → `/account?returnTo=<searchUrl>`; after the
first program saves, show "Back to your SFO→NRT search." Evidence: `components/VerdictRail.tsx:81,209`,
`app/login/page.tsx:39`. The single highest-impact activation fix found.
> **Prompt:** In hop, fix the broken activation bridge from
> docs/plans/2026-07-03-critical-review-roadmap.md R1.1: components/VerdictRail.tsx:81 computes
> owns = usingPoints && hasRealBalances and ignores isSignedIn, so signed-in users with zero
> programs are told "Sign in to see if your miles win" and lose their search through the login
> bounce. Add the signed-in-no-programs CTA state routing to /account?returnTo=<current search
> URL>, persist returnTo through program-add, and render a return banner on /account. Run
> copy-voice-reviewer on the new strings.

**R1.2 — Lead the hero with the verdict.** Seeded search form + live sample verdict above the
fold; chat becomes the secondary door. Cheap first step: swap section order
(`app/page.tsx:147-163`). Measure with R0.5 events.
> **Prompt:** In hop, restructure the signed-out home hero per
> docs/plans/2026-07-03-critical-review-roadmap.md R1.2: the primary above-the-fold action
> should be the verdict demo (seeded SearchBar + the reconciling SampleVerdict side by side),
> with the /ask composer demoted to a secondary door. Start by reordering sections in
> app/page.tsx, keep flat-editorial rules (docs/design/CHOSEN-editorial.html), verify the sample
> verdict still reconciles with copy-spec's canonical example, and run copy-voice-reviewer.

**R1.3 — Keep the watch promise.** Surface `cronLive` into `WatchThisRoute`/`VerdictRail`: until
`STANDING_ORDERS_CRON_ENABLED` is on, the copy is "hop saves this watch — alerts go live soon";
after R0.4 flips it, the current promise copy returns. Alerts are hop's only retention mechanism
— they must not lie.
> **Prompt:** In hop, make the Watch-this-route promise truthful per
> docs/plans/2026-07-03-critical-review-roadmap.md R1.3: WatchThisRoute.tsx:87-89 promises "hop
> pings you" but the standing-orders cron 503s until STANDING_ORDERS_CRON_ENABLED flips and
> email needs verified DKIM. Thread the same cron-liveness signal StandingOrders.tsx:38-41
> already uses into WatchThisRoute/VerdictRail and swap the promise copy accordingly. Run
> copy-voice-reviewer and degradation-reviewer.

**R1.4 — De-friction program entry.** Allow adding a program with balance unknown ("hop still
shows you the route's value"); a one-tap "add the 5 majors" quick-start; configure
`AWARDWALLET_CONNECT_URL` if available. Activation must not equal data entry.

**R1.5 — Verdict receipts (`/v/[id]` + OG card).** Build
`docs/plans/2026-07-02-viral-differentiation.md` Phase 1 as written — the only specced item that
lets a stranger encounter hop's core number. Then seed it personally: 10-15 "here's the actual
math" replies in r/awardtravel and FlyerTalk threads.
> **Prompt:** In hop, implement Phase 1 of docs/plans/2026-07-02-viral-differentiation.md
> (verdict receipts): /v/[id] share pages with OG cards behind HOP_ENABLE_SHARE_RECEIPTS,
> engine-computed numbers only, no LLM content. Follow the plan's spec exactly; run
> review-parallel over the diff before merging.

**R1.6 — Newsletter capture.** Ship `docs/plans/2026-07-02-newsletter-signup.md` (~1 day,
pattern-clone the escalation intake) so receipt/SEO traffic that won't sign up isn't lost.

**R1.7 — Design P1s only.** (a) Fix on-teal contrast: `--color-hero-label`/`--color-hero-eyebrow`
fail 4.5:1 on `--color-brand` at 11-12px on the flagship verdict (`VerdictRail.tsx:124,328`);
(b) full-sentence `aria-label` on the split verdict h1 (`VerdictRail.tsx:130-160`); (c) brand the
chrome: nav mark `text-brand` + restore the mark+wordmark lockup (unused `components/Wordmark.tsx`
exists). Defer the rest of the design train to Phase 2.
> **Prompt:** In hop, fix the three design P1s in
> docs/plans/2026-07-03-critical-review-roadmap.md R1.7: (1) lighten --color-hero-label and
> --color-hero-eyebrow in app/globals.css to clear WCAG AA 4.5:1 against --color-brand (they
> currently sit ≈3.3-3.7:1) and add the on-dark pairs to the contrast checks; (2) give
> VerdictRail's split h1 an aria-label carrying the full verdict sentence; (3) color the TopNav
> FlyingBunny text-brand and mount the existing Wordmark.tsx as a mark+wordmark lockup per
> CHOSEN-editorial.html's masthead. No other design changes in this diff.

### Phase 2 — earn attention (weeks 5–8)

**R2.1 — Public `/mcp` page + registry submissions.** The server is production-grade and metered
(`lib/mcp-usage.ts`) but discoverable only after sign-in (`app/account/page.tsx:486`). Ship a
public "use hop from Claude/Cursor" page, submit to MCP registries, and treat it as
activation/retention (the differentiated mode needs an account), not top-of-funnel.

**R2.2 — Honest award handoff.** Deep-link award searches where airlines accept query params
(AS/UA/DL/B6); elsewhere render a copyable search recipe ("NRT, Jul 9, 1 adult, Business") in the
handoff. Kills the re-key-everything ending (`lib/booking.ts:7-33`).

**R2.3 — One retention loop.** Weekly user digest ("your wallet's best redemption this week")
via the existing outbox + a "this week's movers" strip on `/deals` fed by valuation telemetry
(needs R0.4). `/deals` today is a static 35-row table dressed as live.

**R2.4 — The eight program guides.** Content plan P1 head terms ("best use of Amex MR points"
etc.) interlinked with the existing `/points` / `/sweet-spots` / `/destinations` mesh. The
current programmatic pages are honest but thin; guides are the realistic organic wedge.

**R2.5 — Design-system enforcement pass.** Codemod the 913 arbitrary `text-[Npx]` (83×12.5px,
71×13.5px, seven half-pixel sizes) onto ~9 blessed steps + lint-ban new ones (the tracking ban
worked); reconcile `DESIGN-SYSTEM.md` with `globals.css` (wrong tokens/easing/motion — it
currently misleads agents); bless-or-remove the unblessed stock `text-sm`/`text-2xl` namespace
re-point; add a `chat` glyph and reserve the lightbulb for memory (six meanings today); delete
the ghost `hop-appear` class + 48 inert `--hop-delay` props or build the staged reveal
deliberately.
> **Prompt:** In hop, run the design-system enforcement pass from
> docs/plans/2026-07-03-critical-review-roadmap.md R2.5. Sequence: (1) reconcile
> docs/design/DESIGN-SYSTEM.md against app/globals.css so the canon stops misdescribing tokens,
> easing, and motion; (2) collapse arbitrary text-[Npx] usage onto a blessed ~9-step scale by
> codemod and add an eslint ban like the existing tracking-[…] ban; (3) audit the stock
> text-sm/text-2xl namespace re-point and either bless or rename; (4) add a chat icon to
> components/Icon.tsx and swap the four concierge entry points off the lightbulb; (5) delete
> hop-appear and inert --hop-delay props. Run copy-voice-reviewer + a visual spot check per
> surface.

**R2.6 — Route/cabin-aware demo fixtures.** Gate for any press/reviewer outreach: `MOCK=1` must
not visibly contradict "computed, never generated" (identical verdicts across routes/cabins is
"the single most damaging thing a demo could show an expert").

### Phase 3 — prove the business (weeks 9–13)

**R3.1 — seats.aero written commercial terms + a fallback leg.** Owner email from a company
address disclosing the use case (their docs invite it); in parallel, prototype one fallback
award source behind the existing `degraded[]` seam so `assembleSearch` survives losing the
landlord-competitor. **Blocks flipping `HOP_ENABLE_BILLING`** — do not build a paid product on
an unlicensed feed.

**R3.2 — Flip billing at an early price.** Once alerts demonstrably fire (R0.4 + R1.3) and the
Stripe lane is tested (R0.2): launch premium at an explicitly-early $49/yr (PointsYeah parity at
$99 is unearned with ~half the coverage and no reputation); make MCP metering tier-aware
(`getUserTier` is one import away). A paying-user signal is worth more than the margin.

**R3.3 — Card affiliate reality.** Start the CJ/Impact application now (approval latency is the
blocker, not code); real `applyUrl`s replace the `?ref=hop-card` placeholders when approved;
judge by the outclick baseline from R0.5/R0.6.

**R3.4 — One B2B2C conversation.** The strongest moat evidence points at engine-as-embeddable
layer (Bilt→Points Path; Capital One/Hopper). Take the MCP demo to one warm issuer / fintech /
credit-union travel portal conversation. One signed API partner beats a thousand directory
installs.

**R3.5 — Roundup/press outreach.** Pitch Frequent Miler / OMAAT / comparison-post authors —
gated on R0.1 (math) and R2.6 (demo). hop currently appears in zero of the roundups that drive
discovery in this segment.

### Owner actions (calendar, not code)

- seats.aero commercial-terms email (R3.1 — start now, it gates billing).
- Trademark consult (1 hour) on "hop" + bunny in classes 39/42; register @hopflights handles.
  The category+animal overlap with Hopper is the historically risky combination.
- AwardWallet partner API: ask formally; a written "no" is strategic information.
- Resend DKIM verification for hop.flights (gates every alert/digest email).
- CJ/Impact affiliate applications.

### Kill / freeze list (explicit non-goals until further notice)

- **Freeze `eve/`** — mark "spec only — do not extend until deployment is scheduled" in its
  README and fix its env-name drift (`DUFFEL_API_KEY` → `DUFFEL_API_KEY_LIVE` etc.). It taxes
  every review while deployed nowhere.
- **Freeze memory axes** — conversation-memory, inferred-facts, memory-outcomes stay dark;
  no new axes until one of the three is flipped on and observed changing a user session
  (candidate ADR).
- **Delete dead code** — `SubscriptionPaywall.tsx` + `app/api/subscriptions/*` (R0.2),
  `lib/prefs-parser.ts` (zero production callers), the `PARALLEL_API_KEY` / `AUTONOMA_*` /
  `FIRECRAWL_API_KEY` env seams (zero consumers), `lib/billing.ts` *only if* R0.2 chooses the
  inline path.
- **Defer** — hotels (already deferred, keep it that way), Eve WF3-5, agentic M6-M8, `/compare`
  SEO pages, any new "AI travel planner"-shaped surface, valuation-moat storytelling until ≥5
  programs clear the 20-sample gate.
- **Doc hygiene (one small PR)** — mark `2026-06-28-001-…` superseded; add ADR 0007 to the ADR
  index; sweep "Auth0" references in 07-02 plans to Better Auth; update monetization plan status
  to reflect its shipped rail.
> **Prompt:** In hop, execute the kill/freeze list from
> docs/plans/2026-07-03-critical-review-roadmap.md: freeze notices for eve/ and the dark memory
> axes, deletion of the listed dead code and env seams (verify zero consumers first with grep),
> and the doc-hygiene sweep (supersede the 06-28 plan, fix the ADR index to include 0007,
> replace stale Auth0 references, update the monetization plan status). Keep it to
> deletions/docs — no behavior changes — and run npm run check.

### North-star instrumentation (what "working" means)

Weekly, from R0.5 events + ledgers: sign-ups → first program → first verdict (activation rate);
weekly active searchers; watches created / alerts fired / alert CTR (retention); receipts
created/shared (acquisition); cash + card outclicks (revenue). The 90-day bar: **100 weekly
active searchers and one real dollar attributed end-to-end.**

---

## Part 3 — how to continue from this session

Each item above carries its own prompt. For a fresh session with no specific target:

> Read docs/plans/2026-07-03-critical-review-roadmap.md. Report which roadmap items (R0.1-R3.5)
> are complete/in-progress/open by checking the code, then pick the highest open item in the
> lowest open phase and execute it per its continuation prompt, following the compound loop
> (plan → work → review-parallel → compound).

For the review to stay honest, re-run it after Phase 1 lands:

> Re-run the six-lens critical review from docs/plans/2026-07-03-critical-review-roadmap.md
> (value prop/moat, design, user journeys, implementation, growth/monetization, strategy-doc
> drift) against the current code. Diff the findings against Part 1 of that doc, mark what's
> resolved, and append a dated addendum with anything new.

## Addendum — status as of 2026-07-04 (post launch-readiness audit + PR #167)

A 15-agent audit re-verified every item against code at `6ec5212`; PR #167
(`feat/launch-readiness`) then closed the open code-side items. Verified state:

- **Complete (code):** R0.1 (engine + tests landed earlier; the missing
  ResultsList party-basis label shipped in #167), R0.2, R0.3, R0.5 (all five
  events + identify, #167), R0.7, R1.1 (#167), R1.2, R1.3, R1.7 (#167),
  kill/freeze list + doc hygiene (#167).
- **Code-complete, ops verification open:** R0.6 — the /api/go/kiwi ledger is
  live; still unverified whether Travelpayouts attribution survives the
  same-origin 302 (check prod devtools; tp.media hosts are pre-allowlisted).
- **Ops-only, still open (docs/ops-runbook.md):** R0.4 — deploy
  cloudflare/valuations-worker + flip HOP_ENABLE_VALUATION_SYNC, flip
  STANDING_ORDERS_CRON_ENABLED, set explicit BETTER_AUTH_SECRET, verify
  Resend DKIM, set NEXT_PUBLIC_POSTHOG_KEY, one real Stripe test purchase.
  `/admin/ops` (new in #167) now shows every seam's state, so the flips are
  confirmable at a glance.
- **Open (next up):** R1.4 (balance-optional add + 5-majors quick-start),
  R1.5 (verdict receipts), R1.6 (newsletter), then Phase 2.
- **Beyond the roadmap, shipped in #167:** production 404 for the /api/cash +
  /api/awards debug handlers, baseline security headers, verified-email admin
  gate, account deletion (the /privacy promise), and the /admin ops console
  (preflight, revenue-click ledger, degradation drilldown, watch list,
  ticket/escalation lifecycle).

## Part 4 — Linear reconciliation

The `hop` Linear project (team n3wth) predates the Neon/Better-Auth cutover; several backlog
issues are stale or superseded:

- **N-268/269/270 (alerts schema/UI/email)** — superseded by shipped standing orders +
  notification outbox; remaining truth is R0.4 (flip the cron) + R1.3 (honest copy).
- **N-273/274 (Stripe schema/billing page)** — superseded by the shipped billing rail; the real
  open work is R0.2 (unify the stacks). N-273 references Supabase tables that no longer exist.
- **N-276/277 (sweet-spots/destinations SEO)** — shipped; close.
- **N-289 (paywall)** — reframe on R0.2 + R3.2 (price at $49/yr early, not $99).
- **N-281/291 (hotels)** — keep deferred (matches this roadmap).
- **N-292 (design modernization)** — subsumed by R1.7 + R2.5.

**Follow-up (not yet done):** mirror R0.x-R3.x into Linear (same titles, `R#.#` prefixes) and
apply the reconciliation above — Linear writes were blocked in the session that produced this
doc. This file remains the source of truth for sequencing either way. Paste-ready prompt:

> In the Linear team n3wth, project "hop": create one issue per roadmap item R0.1-R3.5 from
> docs/plans/2026-07-03-critical-review-roadmap.md (title = `R#.# <item title>`, description =
> the item's summary + evidence refs + its continuation prompt, priority Urgent for Phase 0,
> High for Phase 1, Medium for Phases 2-3), plus one issue for the kill/freeze list. Then apply
> Part 4's reconciliation: close N-276/N-277 as shipped, comment on N-268/269/270 and
> N-273/274 that they're superseded by standing orders and the R0.2 Stripe unification, and
> link N-289 and N-292 to their R-item successors.
