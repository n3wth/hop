# Value-prop audit — 2026-07-02

Five critical personas (Optimizer Olivia, Newbie Nate, Skeptic Sam, Family Fiona, Last-minute Leo)
drove the live app end-to-end via Playwright, plus an independent competitive-positioning pass and
a mechanical performance scan. Findings below; correctness/perf fixes from this pass have already
shipped (see the accompanying commit). This doc is the durable record and the backlog for what's
left.

## The promise vs. what lands

- **Olivia** (points expert, 690k+ points across 3 programs): read the landing page correctly —
  "reads my real point balances, live award availability, and today's cash fares... computes a
  real cpp verdict." "See the math" delivered on that promise with genuine transparency. But three
  different searches (SFO-NRT business, SFO-NRT economy, default SFO-LAX) returned an *identical*
  verdict, and a business-cabin search's top pick was labeled "Main" (economy) — she would not
  trust the engine with a single point transfer on this showing. **Root cause confirmed as a
  MOCK=1 fixture limitation, not a production defect** (see below) — but it's the single most
  damaging thing a demo/first-touch could show an expert.
- **Nate** (newbie, doesn't know what a point is worth): the pitch clicked in 5 seconds, and "See
  the math" plus numbered transfer steps taught him the mechanics without ever needing the term
  "transfer partner." Would maybe return — undercut by fake-looking six-figure balances shown
  while signed out (fixed this pass) and a dead "how we value points" link (fixed this pass).
- **Sam** (skeptic, hunts for affiliate funnels): read hop as "a neutral calculator." Every number
  he independently verified — the live search verdict, all 24 `/deals` cards, the Kiwi commission
  math — reconciled exactly. Privacy/Terms disclosures were more thorough than most travel sites he's
  used. The one thing that broke trust: the homepage's own sample verdict didn't reconcile
  (**fixed this pass**) — "a company selling 'trust our math' cannot have its own homepage example
  fail that math."
- **Fiona** (parent, 4 travelers, fixed dates, 20 minutes on a phone): the landing page skews
  toward open-ended AI inspiration, not "I already know my trip" — her use case is a small link,
  not the primary CTA. The verdict silently showed single-passenger economics under a "4
  travelers" header with no per-person label — a MOCK-fixture limitation (mock data has no
  adults-scaling), but the *lack of a "per person" label* would apply equally to live data and is
  a real gap. The mismatched cash-booking link she found was a **real bug, fixed this pass**.
- **Leo** (time-pressed, books on the spot): "the verdict framing and 'see the math' transparency
  are genuinely well done," but the one flow that mattered to him (business-class, book fast)
  silently downgraded his cabin (MOCK fixture), lost the cabin filter after sign-in (**real bug,
  fixed this pass**), and dead-ended at a login wall with no path to actually book. Would bail to
  Google Flights for urgent trips today.

## The true value proposition

**What hop can honestly claim today** (validated by the competitive-positioning pass): hop is the
only points-vs-cash tool that combines three live legs into one computed number — the user's real,
merged loyalty balances (AwardWallet + manual), live cash pricing (Duffel), and live award
availability (Seats.aero) — into a specific dollar-savings verdict, not a search result the user
has to interpret. And it's the only one exposing that engine over MCP with a per-user token, so any
AI agent can query a specific user's real verdict, not just a browser tab.

> hop is the only points-vs-cash tool today that turns your real, live loyalty balances plus
> today's actual cash and award prices into one computed dollar-savings verdict — and the only one
> that hands that exact engine to your AI agent over MCP with your own token, not just to you in a
> browser tab.

**The aspirational claim** — "the fastest way to know whether to book with points or cash, for any
trip, with the confidence to act immediately" — is not yet earned. What's missing, per the personas
above: (1) a demo/mock experience that doesn't visibly contradict the "computed, not generated"
promise under adversarial inspection; (2) a completed booking loop (native checkout is
flag-gated off; cash CTAs deep-link to generic airline/affiliate homepages, not the searched
itinerary); (3) program coverage broader than the ~14-15 programs currently mapped, against
competitors claiming 19-30+; (4) social proof — zero reviews/press/user count anywhere on the site
for an unfamiliar brand.

## Where trust breaks (ranked, with evidence)

1. **Homepage math didn't reconcile** (Sam) — $243 claimed for 25,000mi × 2.1¢/pt (=$525 actual).
   First thing a skeptical visitor sees. **Fixed this pass** — realigned to copy-spec's canonical,
   exact example.
2. **Fake-looking balances shown pre-auth with no "example" label** (Nate AND Olivia,
   independently) — a full 6-program, $11K wallet visible directly above "Sign in to see if your
   miles win." Both personas' independent top concern. **Fixed this pass.**
3. **Cash-booking link pointed to the wrong trip** (Fiona AND Leo, independently) — one CTA on the
   results page correctly reflected the search, a second ("Book cash") pointed to a stale
   SFO→LAX/Jul-2026 URL regardless of the actual route. **Fixed this pass** — root cause was
   `lib/mock.ts`'s fixture baking in a hardcoded `bookingUrl` that MOCK mode's route-rewriter never
   recomputed; the real Duffel path was never affected.
3. **Cabin filter silently dropped after sign-in** (Leo) — `returnTo` only carried
   from/to/depart/adults/return, not cabin/children/infants. **Fixed this pass.**
4. **Dead "How we value points" anchor link** (Nate) — pointed at a nonexistent `#how-hop-decides`
   id; the real explainer lives at `#the-verdict`. **Fixed this pass.**
5. **Sponsored credit-card CTA visually blended into the verdict box** (Sam) — same container as
   the objective math, only spacing (no divider) between them. **Fixed this pass** — added a
   hairline top border.
6. **Verdict compares mismatched party-size totals for `adults > 1`** (Fiona's finding, root-caused
   further this pass) — a real engine bug, not a MOCK artifact: live cash pricing is already
   summed across all passengers (Duffel), but award miles/taxes are always per-seat (Seats.aero
   never scales by party size), so the computed cpp is inflated by roughly the party size for any
   multi-passenger live search. **Not fixed this pass** — elevated to P1, see backlog for the full
   root-cause and fix sketch; deliberately not patched under time pressure given it touches the
   core money-math engine.
7. **Degraded `/ask` fallback ignores what the user actually typed** (Olivia, Nate, Fiona, Leo — all
   four) — when the LLM call fails, the fallback lists generic Hong Kong/Tokyo/Melbourne
   inspiration regardless of the user's stated route/points/party size. Judged as "good degradation
   hygiene, zero relevance" by every persona who hit it. **Not fixed this pass** — see backlog P2.

## MOCK-fixture artifacts vs. real defects (explicitly separated per the audit brief)

Several persona findings looked like product defects but were verified against the real (live
Duffel/Seats.aero) code path and confirmed to be **local-dev fixture limitations only**:

- **"Same verdict across different routes/cabins"** (Olivia) — `lib/mock.ts`'s `mockAwards()` /
  `mockCash()` are static, parameter-less functions by design (CLAUDE.md: "MOCK=1 swaps in
  fixtures... for local dev/testing, no upstream API keys needed"). `lib/search.ts`'s MOCK branch
  only rewrites route/date labels on the fixed fixture, not the underlying numbers.
- **"1h32m nonstop SFO→NRT" / "Main cabin on a business search" / "Southwest on an international
  route"** (Olivia, Leo) — same root cause: one hardcoded flight object reused regardless of the
  real route/cabin.
- **Verified NOT affected**: `lib/duffel.ts` (`duffelCabinClass(params.cabin)`) and
  `lib/seatsaero.ts` (`requestedCabinKey`, `pickCabin(rec, params.cabin)`) both correctly thread
  the requested cabin into live upstream calls and cache keys. Cabin filtering works in production;
  it just doesn't work against the static mock fixture.

This is real technical debt in the *demo/dev experience* (worth fixing eventually so an
investor/partner demo run with `MOCK=1` doesn't visibly fail its own arithmetic under inspection),
but it is not a live-data correctness bug and was correctly out of scope for a quick fix this pass.

## What would make each persona pay/return

- **Olivia**: a verdict that visibly varies by route/cabin/date (i.e., either demo against real
  upstream keys, or invest in route-aware mock fixtures) — she'd pay for a tool that beats her
  manual point.me/seats.aero/Google-Flights cross-check *if* the math is provably live.
- **Nate**: already close — the transparency ("See the math", numbered transfer steps) is genuinely
  better-than-expected for a newbie. Needs the trust breaks above fixed (done) plus a plain-language
  legend for cpp thresholds on `/deals` (not yet done).
- **Sam**: already close — disclosures, per-click commission transparency, and Terms/Privacy
  scored well against his adversarial read. The one blocking issue (homepage math) is fixed.
- **Fiona**: needs group-aware economics (or explicit "per person" labeling), bigger mobile date-
  picker tap targets (measured 24.5×24.5px, under the ~44px accessibility minimum), and seat-
  availability-together disclosure for multi-passenger award bookings.
- **Leo**: needs a real book path for a signed-out user who already knows their balance covers the
  fare (today the only CTA on a winning pick is a login wall), and the secondary CTAs
  (Book-with-miles, Transfer-and-book) need to deep-link to the actual flight instead of generic
  airline homepages.

## Competitive edge & exposure

**Edge** (verified against the 2026 landscape — point.me, Roame, seats.aero, AwardTool, Google
Flights + Points Path, Kayak, Chase/Amex Travel):
- Only tool combining live user balances + live cash + live award availability into one computed
  $-verdict (competitors do zero, one, or two of these three legs)
- Only tool exposing the verdict engine over MCP with a per-user token
- Free today vs. $10-13/mo for the closest comparable feature depth elsewhere (point.me, Roame,
  seats.aero Pro, AwardTool Pro)
- Architectural trust invariants (`assembleSearch` never throws, every number engine-computed) are
  structural, not marketing copy

**Exposure**:
- Program coverage (~14-15 mapped programs) is narrower than point.me (30+) and Roame (19+)
- Fully dependent on Duffel/Seats.aero/AwardWallet — no proprietary data
- No mobile app (Roame and point.me both ship native apps)
- No completed booking loop — native checkout is flag-gated off; cash CTAs deep-link out
- Zero social proof / brand trust — no reviews, press, or user count anywhere on the site
- Standing-orders cron cadence (6h) is plausibly slower than dedicated alert products

## Prioritized backlog

**P1 — blocks the core value loop**
- **Multi-passenger cpp is computed against mismatched totals — a real engine bug, not a MOCK
  artifact.** Investigating Fiona's "single-passenger economics under a 4-traveler header" finding
  further (beyond what she could see from the UI alone) surfaced the root cause in
  `lib/search.ts`'s award-annotation step (`awards.map`, ~line 160-166):
  `cpp(cheapestCash, taxes, miles)` compares `cheapestCash` — Duffel's `total_amount`
  (`lib/duffel.ts:115`), which is **already summed across the full passengers array**
  (`buildPassengers`, `lib/duffel.ts:83-91`, sized to `params.adults`) — against `miles`/`taxes`
  straight from Seats.aero, which are **always per-seat** (`lib/seatsaero.ts` never references
  `params.adults` at all). For any live search with `adults > 1`, this inflates the computed cpp
  by roughly the party size (e.g., a 4-person $1,000 cash total compared against 1 seat's worth of
  miles instead of 4 seats' worth), which can flip the verdict tier entirely. This is NOT a MOCK
  fixture limitation — `mockCash()`/`mockAwards()` don't scale with party size either, so the bug
  is silent in local dev and only manifests against live Duffel/Seats.aero data.
  **Fix sketch**: scale `o.miles` and `o.taxes` by seat count
  (`params.adults + (params.children ?? 0)`; infants are lap-only, no seat) at the same point cash
  is already party-total, so both legs of the comparison represent the same "cost to move the whole
  party." Needs care around every downstream consumer of `miles`/`cpp` (the "You pay N miles" stat,
  `youHaveFor`/`effectiveBalanceFor` balance-sufficiency checks, `SeeTheMath`'s breakdown) — a
  single-passenger search (the overwhelming majority of real traffic) must be provably unaffected.
  Given this touches the core money-math engine, route it through `engine-invariant-reviewer`
  before merging, not a quick patch. Effort: M.
- Make `MOCK=1` fixtures vary by route/cabin (see Olivia's finding, and the "MOCK-fixture
  artifacts" section above) so a live demo/walkthrough doesn't visibly fail its own arithmetic.
  Effort: M.

**P2 — trust/conversion**
- Give `/ask`'s degraded-mode fallback minimal query awareness (route it through hop's own
  `/deals`/balance data for the named city/program instead of a fully generic list). Why: all four
  personas who hit the fallback. Effort: M.
- Real book path for a signed-out visitor who already knows their balance covers the fare, instead
  of a hard login wall as the only CTA on a winning pick. Why: Leo. Effort: M — needs product
  design (what does "book" mean pre-auth?).
- Deep-link the secondary CTAs (Book-with-miles, Transfer-and-book) to the actual searched flight
  instead of generic airline/partner homepages. Why: Leo. Effort: S-M depending on airline deep-
  link support.
- Plain-language cpp legend on `/deals` next to the ¢/pt badges (today: color + a screen-reader-
  only label only). Why: Nate. Effort: S.
- Seat-availability-together disclosure for multi-passenger award searches. Why: Fiona. Effort: M
  (`lib/seatsaero.ts` has no seat-count field today).
- `nonstop` filter doesn't round-trip through sign-in (only `cabin`/`children`/`infants` were fixed
  this pass; `VerdictRail` doesn't currently receive the `nonstop` prop needed to include it).
  Effort: S.

**P3 — polish**
- Route-aware `MOCK=1` fixtures (see P1 note — demoted to P3 unless a demo is imminent). Effort: L.
- Mobile date-picker tap targets below the ~44px accessibility minimum (measured 24.5px). Why:
  Fiona. Effort: S.
- Landing page leads with open-ended AI inspiration; a decided visitor who already knows their
  route has to find a small "Search a specific route" link. Why: Leo, Fiona. Effort: S (surface
  the structured search form more prominently) to M (redesign the hero balance).
- Expand mapped-program coverage beyond ~14-15 programs to close the gap with point.me (30+) /
  Roame (19+). Effort: L.
- Social proof on the landing/login surfaces (even a quiet "N searches run" or press mention) for
  an unfamiliar brand. Effort: S-M (needs real numbers to be honest).
