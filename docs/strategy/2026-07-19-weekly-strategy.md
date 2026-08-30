# hop weekly strategy review — 2026-07-19

Marcus, strategy desk. Baseline: `docs/board/2026-07-19-board-memo.md` (adopted amendments, §7's
ranked list) — dated *today*, so unlike prior weeks this run's board memo already reflects
current reality and is not a week stale. Per `docs/agent-playbook.md`'s ownership order, the
board's ranked list wins on any conflict; this review folds in evidence from *this run* (a fresh
PostHog pull and a market scan) the board's own cutoff could not have had, and otherwise defers
to it rather than re-deriving a competing ranking.

## (a) What's working

- **The engine still resolves reliably.** Every day with a nonzero `search_ran` count also shows
  an equal `verdict_viewed` count over the last 14 days (PostHog `query-trends`, 7/5–7/19) — the
  core "trust our math" invariant continues to hold under real, if thin, traffic.
- **New this run — the first real conversion since instrumentation shipped landed 2026-07-18,
  and it looks genuine, not a fluke.** `signed_up` and `first_program_added` both fired exactly
  once, at 2026-07-18 21:42–21:43 PT — the first nonzero read on either event across 14 days of
  data (2026-07-05 through this run). Traced the full session via `execute-sql`: a single mobile
  Safari visitor arrived direct (`$direct` referrer, no campaign), ran a search SFO→JFK, then
  SFO→AMS, browsed `/ask` and `/account`, signed in via Google OAuth, added a program, used
  "quick start," then kept exploring — `/deals`, an `/ask` query ("Somewhere warm for 40k
  points"), and three more searches (SFO→HKG, SFO→HND ×2) — across a 17-minute, clearly engaged
  session. This is `n=1` and can't be fully ruled out as the founder's own device (no email was
  captured on the event), but the unhurried multi-destination browsing pattern and organic
  referrer read as a real visitor, not a smoke test. **This directly updates the board memo's own
  framing** — written before this event landed — that "the CTA fix produced zero new signups
  against a 14-visitor/week baseline" and "a conversion-copy fix has nothing to convert." That
  diagnosis was accurate as of the board's data cutoff (last funnel-log entry 7/17); it's now one
  data point out of date. Not claiming the funnel is fixed — one conversion doesn't overturn 12
  days of zero — but this is the single most important thing to watch next week: if it repeats,
  PR #286's CTA fix (`showAccountNudge`) may actually be working now that there's enough traffic
  to test it; if it doesn't, this was a one-off and the board's "traffic, not funnel" diagnosis
  stands unmodified.

## (b) What's stalled

- **The board's own follow-through count this run: 1 of 13 prior amendments done, 1 net-negative
  (content freeze violated a second time), 11 unchanged or worse** (`docs/board/2026-07-19-board-memo.md`
  §2). Not re-litigating that count here — citing it because it's this week's ground truth on
  execution velocity, and every item below inherits it.
- **N-320 (seats.aero written terms) and N-319 (`/pricing`) are both still open, exactly where
  the board found them.** N-320: `status: Backlog`, `startedAt: null`, unchanged since creation
  (2026-07-04). N-319: `status: In Progress`, `startedAt: 2026-07-06`, now 13 days with the same
  status and (per the board's fresh finding) a real defect — `app/pricing/page.tsx`'s `metadata`
  export is static, not gated on `isBillingEnabled()`, so the page's `<head>` advertises $49/yr
  unconditionally.
- **Traffic (7d, hop.flights-only, `$host` filter applied): 9 visitors, 125 views, 18 sessions,
  380s avg session, 22.2% bounce.** 14-day: 33 visitors, 429 views, 69 sessions. Consistent with
  the funnel-log's "small, roughly flat" read — this week is not a breakout, the 7/18 conversion
  happened inside the same thin-traffic regime as every prior week.
- **The fallback award-data-source prototype is still zero lines of code**, and structurally
  stuck: it's bundled inside N-320 alongside the owner-only seats.aero-terms email under one
  issue assigned to Oliver with `status: Backlog`. Confirmed by reading N-320's own description —
  it explicitly names two tracks ("owner: start immediately" / "agent-buildable: prototype one
  fallback source"), but living inside one owner-assigned issue means it inherits that issue's
  Backlog status and doesn't show up as pickable agent work. Splitting it out is a Linear action
  taken this run (see §(e)).

## (c) Competitive / market read this week

Budget ~30 min via Exa. Real, cite-worthy activity — more material than a typical week:

- **point.me shipped a major platform upgrade on 2026-07-16 that lands almost exactly on hop's
  core differentiator.** "Explore" (a map-based award-discovery tool: search by points balance
  and flexible dates instead of a fixed route), "My Points" (a digital wallet connecting credit
  cards and loyalty accounts, showing three prices side by side — cash, points via a card
  portal, and points via airline transfer), transfer-bonus integration, and faster search
  (sub-20s, down from ~1 minute). Covered by PRNewswire, The Points Guy, Upgraded Points,
  Travelbinger, and Travel And Tour World — wide, credible pickup, not a single blog's spin.
  [PRNewswire](https://www.prnewswire.com/news-releases/pointme-launches-explore-a-new-map-based-discovery-tool-for-award-flights-302827571.html)
  (2026-07-16), [The Points Guy](https://thepointsguy.com/news/point-me-new-features/)
  (2026-07-16). **Why this outranks last week's seats.aero finding**: seats.aero's AI Assistant
  (found 7/12) recommends *destinations*; point.me's "My Points" recommends *whether to use your
  own points*, connected to your actual balances, shown as three comparable prices — that is
  hop's cpp-verdict pitch, shipped by a well-funded (Nyca, Citi Ventures, Samsung, Brian
  Kelly/TPG), well-distributed incumbent with a TPG marketing partnership hop cannot match.
  hop's remaining structural edges are narrower than last week's read implied: (1) live
  *observed* cpp (`lib/valuations-live.ts`) vs. point.me's static "Good/Great" value labels, and
  (2) MCP/agent-native distribution, which point.me has not touched.
- **New, concrete evidence for the MCP-distribution bet specifically**: a journalist's test this
  month asked Gemini, Claude, and Copilot "what's the best way to search for award flights."
  Every model recommended established aggregators — point.me, Seats.aero, Roame.travel,
  PointsYeah, AwardFares, ExpertFlyer — **none mentioned hop**
  ([McGarvey's Words](http://www.mcgarvey.net/2026/06/11/hunt-for-awards-seats/), 2026-06-11,
  re-surfaced in this week's scan). This is a small, single-article sample, but it's a direct,
  falsifiable test of "does a general-purpose AI agent already know hop exists," and the answer
  right now is no. It sharpens — without changing — the board's already-ranked MCP-directory-
  submission item (§7 #12): the gap it's meant to close is measurable, not hypothetical.
- **Award Travel Finder's MCP endpoint is confirmed live and more built-out than last week's scan
  suggested**: OAuth-secured (`mcp.awardtravelfinder.com/mcp`), 24+ programs, "80+ tools"
  including balance tracking (`update_points_balance`, `get_portfolio`), works in Claude Code,
  Claude Desktop, Cursor, Windsurf, and ChatGPT, with a published Claude Code plugin on GitHub.
  Free tier: 5 economy searches/day (hop's free MCP tier is 25 calls/day per N-325 — roughly
  comparable). This remains the closest same-shape competitor to hop's MCP wedge; no material
  change from last week beyond confirming production maturity.
- **Devaluation wave, useful as observed-cpp content material, not new risk**: Amex Membership
  Rewards → Flying Blue transfer ratio cut to 1:0.75 took effect 2026-07-01 (confirmed for the
  Netherlands; US remains 1:1 per multiple trackers), and Etihad Guest's removal (announced
  earlier) is now in effect. [Platinum Flyer's July state-of-points
  roundup](https://platinumflyer.com/state-of-points-july-2026/) (2026-07-01) frames this as "the
  worst 48 hours in Membership Rewards history" — exactly the kind of change hop's observed-cpp
  telemetry is built to catch faster than a hand-written post, once enough programs clear the
  20-sample gate (ADR 0005). No action needed this week; noted as continuing evidence for the
  double-down the board already named.
- **Adjacent signal, not a direct competitor**: Fora (AI-assisted human travel-advisor
  marketplace) hit unicorn status on a $60M Series D
  ([TechCrunch](https://techcrunch.com/2026/07/16/ai-powered-travel-agency-fora-hits-unicorn-status-raises-60m/),
  2026-07-16) — confirms capital is flowing into AI-travel broadly, but Fora's wedge (human
  advisors + AI-assisted admin) doesn't overlap hop's computed-verdict/points wedge directly.
  Troveo and Travel Smarter (both named last week) show no material update this run beyond what
  was already logged.
- **AwardWallet, PointsYeah**: no material news this week beyond routine promotion-tracker
  content. PointsYeah was independently named "best award travel search tool of 2026" by
  NerdWallet in a source surfaced this run (strong free tier, 30+ programs, $99.99/yr paid) — not
  new information but worth having explicitly on hop's competitor list alongside point.me and
  seats.aero; it wasn't named in either prior week's scan.

**Net read**: this week's market activity is more material than a typical week, concentrated in
one event (point.me's launch) that narrows hop's differentiation story, not the funnel diagnosis.
The board's core finding — the blocker is traffic and two owner-only decisions, not the product —
stands. What changes is the cost of further delay on the two structural bets the business plan
already stakes hop's future on: observed-cpp data and agent-native distribution are no longer
"probably still defensible," they're the *only* two legs point.me's launch hasn't touched.

## (d) Reprioritization for the coming week

**Adopting the board's ranked list (`docs/board/2026-07-19-board-memo.md` §7) as-is — no
independent reordering.** Unlike the 7/12 run (the first strategy-desk pass, working from a week-
old board memo), this week's board memo is dated today and already incorporates a full
adversarial review with fresh evidence. This run's job is to check whether this run's own data
(the PostHog pull, the market scan) contradicts or reorders it — it doesn't. The board's top 5,
restated for reference with this run's confirmation/refinement noted:

1. **Gate `app/pricing/page.tsx`'s `metadata` export via `generateMetadata()` behind
   `isBillingEnabled()`.** Confirmed still open, cheap, concrete — no new evidence changes this.
2. **Resolve N-319 fully this week (finish or revert/freeze).** Confirmed still open (13 days,
   zero commits). No new evidence changes the ranking; the underlying billing-on-or-off call
   remains `[needs-founder]`.
3. **Start the fallback award-data-source prototype.** Confirmed still zero code. **Refined by
   this run**: point.me's expansion this week is a second, independent reason the "single-vendor
   award-data risk" this item mitigates is compounding, not just persisting — two well-resourced
   incumbents (seats.aero, point.me) are now both closer to hop's exact wedge than they were two
   weeks ago. Also see §(e) — split into its own agent-executable Linear issue this run so it
   stops inheriting N-320's Backlog/owner-assigned status.
4. **Build the content staleness/"verified as of" guard before any further content ships.**
   Confirmed still unbuilt, now violated twice. No new evidence changes the ranking; filed as its
   own Linear issue this run (§(e)) since none existed to enforce it against.
5. **No further `/mcp` page polish until at least one MCP-directory submission lands.** Confirmed
   still open. **Refined by this run**: the "LLMs don't mention hop" finding (§c) is fresh,
   independent, falsifiable evidence for why this specific item — not general GTM — is the
   right next MCP-related priority, sharper than "a funded competitor already has a plugin
   listing" alone.

**One addition, not a reorder**: watch next week's funnel-log read specifically for whether
`signed_up`/`first_program_added` fire again. This doesn't change this week's ranked list (it's a
observe-not-act item), but if it repeats, it's the first real evidence the CTA fix is working and
worth flagging to the board explicitly rather than letting "the funnel is fixed, nothing left to
convert" go unrevisited for another week.

## MRR-gate status (unchanged, confirmed)

Wk1 gate ("payment path proven") is **still not met and not reachable**: N-320 (seats.aero
written terms) is unstarted in Linear (`status: Backlog`, `startedAt: null`), 15 days since the
outreach email with no logged reply; N-321 (flip billing) is sequenced behind it. 17 days remain
to the founder's 2026-08-05 $10k MRR target; the board's own ranked amendment #15 ("decide
explicitly whether to reset the target") remains open and is not this desk's call to make.
