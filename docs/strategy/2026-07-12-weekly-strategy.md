# hop weekly strategy review — 2026-07-12

Marcus, strategy desk. **This is the first run** — `docs/strategy/` didn't exist before this
file. Baseline: `docs/board/2026-07-12-board-memo.md` (adopted amendments, ranked list in its
§7) plus fresh PostHog reads and a market scan this run. Per `docs/agent-playbook.md`, the
board memo's ranked list wins on any conflict; this review folds in evidence from *this run*
that the board's Sunday-13:00 pass could not have had (it fires before this desk's data pull)
and otherwise defers to it.

## (a) What's working

- **R1.5 (verdict receipts), R1.6 (newsletter), R2.1 (public /mcp page)** all shipped this
  week with commit evidence (PR #253, #251+#264+#266, #280) — the board's own top-3 amendment
  items from last week, all done. Confirmed via `docs/board/2026-07-12-board-memo.md` §2.
- **The admin-UI/nav-polish freeze held** — first clean week since it was declared two retros
  ago (board memo §1).
- **`search_ran` → `verdict_viewed` conversion is still ~100%** when searches happen at all
  (confirmed via PostHog `query-trends`, 7/4–7/8): the engine resolves reliably. This has held
  since instrumentation shipped.

## (b) What's stalled, and one new problem underneath it

- **`signed_up` and `first_program_added` are still zero.** Four consecutive funnel-log reads
  now (7/6, 7/8, 7/10, and this run) — not sampling noise.
- **New this run — the funnel didn't just stall, it went dark.** Pulling `query-trends` directly
  (not from `funnel-log.md`, which hasn't run since 7/10): `search_ran` was 8/7/2/1/2 on
  7/4–7/8, then **0 on 7/9, 7/10, 7/11, and 7/12** — four straight days with zero searches on
  the site at all, worse than "converts at zero," which was the prior read. This needs the
  growth desk's next run (Mon/Wed/Fri cadence) to confirm whether this is a real cliff or an
  artifact of this week's shipping activity pulling traffic to non-search pages (`/mcp`, guides).
- **New this run — the "traffic is rising" read in the board memo and `funnel-log.md` (48→61→
  95 visitors/7d) is likely overstated.** The PostHog project (`n3wth`, id 223560) is shared
  across six hostnames (`hop.flights`, `n3wth.com`, `skills.n3wth.com`, `garden.n3wth.com`,
  `r3.n3wth.com`, `ui.n3wth.com`) — a personal site, a skills/knowledge-garden site, and others,
  confirmed via `$host` property values on `$pageview`. Every `query-web-overview` call in this
  review's evidence trail up to now (and, going by its numbers, in prior `funnel-log.md` entries)
  appears to have queried the whole project unfiltered: this run's unfiltered 7-day pull returned
  **125 visitors**, dominated by pages like `/recipes`, `/raised-beds`, `/frameworks/mece`,
  `/skill/imessage` — none of which are hop.flights routes. Filtered to `$host = hop.flights`,
  the real number is **25 visitors / 7d** (51 sessions, 304 views), and **27 visitors over the
  last 14 days** — meaning true hop traffic isn't clearly rising, it's small and roughly flat,
  concentrated in the most recent week. The five funnel *event* counts (`search_ran`,
  `verdict_viewed`, `signed_up`, `first_program_added`, `outclick`) are unaffected — confirmed
  `search_ran`'s `$host` property is always `hop.flights`, so those numbers (including the
  zero-signup pattern) are real. Only the generic traffic/session/bounce-rate KPIs are
  contaminated. This is a data-integrity bug, not a business result — flagged as a concrete
  Linear ask below, not something to relitigate the funnel diagnosis over.
- **`/pricing`'s stalled state, unchanged**: board's kill-list item #1, N-319 still "In
  Progress" with the same six-day-old no-commits status this run found too.

## (c) Competitive / market read this week

Real activity, cite-worthy, budget ~25 min via Exa:

- **Seats.aero — hop's own data supplier — shipped an AI redemption assistant** (launched
  ~June 4, reviewed by The Points Guy and independent points blogs). It combines live award
  availability with transfer-partner recommendations and points-balance-aware routing — i.e.
  a superset of hop's verdict engine, built by the party that also controls hop's upstream feed
  and whose terms are the unmet gate on hop's own billing (N-320). This moves the board's
  "contested point" (§4, is seats.aero shipping a competing product) from disputed to confirmed
  fact. [The Points Guy](https://thepointsguy.com/news/seats-aero-ai-redemption-tool/) (2026-06-04).
- **A near-identical competitor is already live with hop's exact differentiator.**
  [Award Travel Finder](https://awardtravelfinder.com/) ("the AI Travel Brain for points &
  miles") explicitly positions itself against seats.aero and point.me, connects loyalty
  accounts + cards, and exposes the same brain via an open MCP endpoint
  (`mcp.awardtravelfinder.com/mcp`) plus a Claude plugin — the exact "balances + AI + MCP"
  pitch the north-star plan (P3c) calls hop's differentiated bet. It is live today, not a
  roadmap item. This sharpens the case for treating MCP directory submissions as urgent, not
  sequenced work — the "first mover in agent-native distribution" window may already be
  closing.
- **point.me** (well-funded — Nyca, Citi Ventures, Samsung, WndrCo, Brian Kelly/TPG) continues
  content/PR-led growth (an "Airline Loyalty Program Rankings" report, a World Cup travel-hub
  micro-product at events.point.me) — not a direct near-term threat to hop's wedge, but shows
  the category leader has marketing muscle hop cannot match head-on; reinforces that hop's
  edge has to stay computed-economics + agent-native, not content-volume.
- **Two more funded/pre-launch entrants** in the same "AI agent for points" space: **Troveo**
  (autonomous rewards optimization, an "Auri" agent) and **FlyMiles** (paid-waitlist, promises
  actual autonomous *execution* not just guidance) — both aimed at the same P2/P4 "agent acts
  first" territory the north-star plan stakes out as hop's future, not present, state.
- **Real devaluation activity, useful as content material, not just risk**: Amex Membership
  Rewards cut transfer ratios to Cathay Pacific and Emirates, is removing Etihad Guest entirely
  (effective 2026-06-30), and cut Flying Blue transfer value 37.5% in the Netherlands
  (2026-07-01, US watchers expect it's a matter of time) — [Platinum
  Flyer's tracker](https://platinumflyer.com/amex-membership-rewards-transfer-ratio-devaluation-tracker/).
  Marriott Bonvoy quietly raised award prices up to 16% ([View From the
  Wing](https://viewfromthewing.com/marriott-bonvoy-just-quietly-raised-award-prices-some-hotels-now-cost-up-to-16-more-points/)).
  This is exactly the kind of change hop's observed-cpp telemetry (`lib/valuations-live.ts`)
  is built to detect faster than a hand-written blog post — a real, if not yet realized,
  content/trust differentiator once the 20-sample gate clears for more programs.
- **Community sentiment**: r/awardtravel/r/churning show hobbyist fatigue this month (a widely
  discussed "is it worth the effort" post), not panic or exodus — no actionable signal for hop
  specifically, noted for completeness per the routine's scan requirement.

**Net read**: nothing here changes the board's fundamental diagnosis (funnel conversion is the
blocking problem, not traffic or awareness). What it does change: hop's "MCP is a
differentiated, patient bet" framing is now factually contested — a competitor is already
executing the identical wedge live. That raises the cost of further delay on MCP directory
submissions and lowers confidence that seats.aero will ever be a cooperative, non-competing
landlord.

## (d) Reprioritization for the coming week

The board's ranked list (§7 of the 2026-07-12 memo) is the baseline. This run has three pieces
of new evidence not available to that Sunday-13:00 pass: (1) the analytics host-filter bug,
(2) the funnel going to zero *searches*, not just zero conversions, for four straight days,
and (3) two live competitors (seats.aero's own AI Assistant, Award Travel Finder) already
executing hop's MCP-agent-native wedge. Folding those in, ranked:

1. **Fix the PostHog traffic queries to filter `$host = hop.flights`.** Fifteen minutes of work,
   blocks every other desk's ability to read this week's numbers honestly — the finance,
   growth, and board reviews have all been implicitly reading a 5x-inflated traffic number.
   Cheapest, highest-leverage item this week precisely because it's foundational to every other
   read. **New this run** — not in the board's list, filed as N-371.
2. **Ship the VerdictRail CTA fix from the 7/10 funnel-log hypothesis** (board's #3, unchanged
   in priority, now sharper: searches themselves dropped to zero the last four days, so this
   is no longer just "fix the conversion rate," it's "confirm the funnel is still reachable at
   all"). Filed as N-372.
3. **Resolve `/pricing`'s stalled state** (board's #2, unchanged — still "In Progress" six-plus
   days with no commits, still live, still linked from `/mcp`). No new evidence either way;
   carrying forward as-is.
4. **Submit the shipped `/mcp` page to 2-3 MCP directories this week** (board's #5, but
   elevating urgency given this run's finding that Award Travel Finder already has a working
   MCP endpoint and plugin distribution) **and** treat the seats.aero fallback-award-source
   prototype (board's #6) as a tied pair with it, not a separate lower-priority item — seats.aero
   shipping its own AI Assistant is now confirmed evidence, not a hypothesis, that the landlord
   is a direct competitor with reduced incentive to grant hop favorable commercial terms.
5. **Explicitly deprioritize further content-pipeline expansion** (`/guides/[program]`,
   more sweet-spot pages) beyond what's already shipped, until the staleness guard exists
   (this affirms the board's kill-list item #2 — no new evidence changes it, but this week's
   market scan adds a second reason: the devaluation-tracking content space is already dense
   and well-covered by Daily Drop, Platinum Flyer, Mainly Miles, and View From the Wing — hop's
   differentiated content angle is computed/observed cpp data those outlets don't have, not
   article volume, so more hand-written guides add little while the observed-cpp telemetry
   pipeline (P5) remains the actually-differentiated version of this lever).

**No change from a prior week's ranking to relitigate** — this is the first strategy-desk run,
so there is no earlier ranking to compare against; the above is built directly from the board's
latest list plus this run's new evidence, per the adoption rule in `docs/agent-playbook.md`.

## MRR-gate status (unchanged, confirmed)

Wk1 gate ("payment path proven") is **still not met and not reachable**: R3.1 (seats.aero
written terms, N-320) is unstarted in Linear despite the outreach email being sent 2026-07-06;
R3.2 (flip billing) is sequenced behind it. No code change this run affects this gate.
