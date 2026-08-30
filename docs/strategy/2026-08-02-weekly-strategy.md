# hop weekly strategy review — 2026-08-02

Marcus, strategy desk. **Baseline**: `docs/board/2026-08-02-board-memo.md` — dated today, a real,
thorough adversarial pass (5 lenses), but **not yet merged to `main`** (open draft PR #383,
created 13:15 UTC today). Per `docs/agent-playbook.md`'s ownership rule the board's ranked list
wins on conflict; per the same rule's newest caveat (added by this same unmerged PR) — "do not
treat a board memo's own prose as proof its content reached `main`" — this review verified every
load-bearing claim independently (live GitHub PR status, a live PostHog pull, a live curl of the
valuation-sync worker, `git log`) rather than trusting the memo's text. Nothing here contradicts
PR #383; this review adopts its ranking and adds new evidence, one genuinely new resolved
question (§a), and independent reconfirmation that its most urgent finding is still true right
now, not just at 13:15 UTC (§b).

## (a) What's working

- **The observed-cpp valuation-sync pipeline is very likely actually live** — the board's own
  §4 "contested point" this week, which it flagged as "resolvable in 10 minutes by someone with
  Vercel dashboard access; nobody has done it." This session doesn't have dashboard access either,
  but three independent code-level signals now converge: (1) `docs/ops-runbook.md`'s current-state
  table (line 27) reads "**ON.** Worker deployed at `https://hop-valuations.newth.workers.dev`
  (D1 schema applied, 6h cron); all three Vercel vars set" — not the ambiguous framing the 7/26
  board memo inferred "inert" from; (2) a direct `curl` of that worker this run gets real,
  structured JSON responses (`/valuations` → `401 {"ok":false,"error":"unauthorized"}`, i.e. the
  route exists and enforces auth — not a dead domain or a 404 root), confirming the worker is
  deployed and running, not vaporware; (3) the board's own travel-industry lens independently
  found `lib/health-checks.ts`'s D5 valuation-drift detector firing with real per-program sample
  counts (delta 1,278, virgin-atlantic 296, alaska 284, etc., 12+ programs past the 20-sample
  trust gate). None of this is a substitute for someone actually opening the Vercel dashboard, but
  three independent sources agreeing is strong enough to act on: **hop has been quietly
  accumulating real, differentiated, first-party cpp-drift data for weeks with nothing public
  built off it.** This is the single most concrete, actionable, good-news finding available this
  week — see §(d) amendment #7.
- **The content-pipeline freeze and the `/pricing` metadata/FAQ pattern are still holding** — no
  regression found this run in either.
- One real activity blip this week (7/30: `search_ran` 5, `verdict_viewed` 5) — but see §(b);
  the same day's `signed_up`/`first_program_added` reads are not real.

## (b) What's stalled

- **The merge pipeline is stuck for a third time, confirmed live at 15:02 UTC today, not just at
  the board's 13:15 UTC write-up.** Directly checked via GitHub's commit-status API: PR #382
  (opened 12:00 UTC) still shows `Vercel: pending` after 3+ hours; PR #383 (the board memo itself,
  opened 13:16 UTC) shows the identical pattern. `main`'s last commit is still `47d9879`
  (2026-07-31T21:09:43Z) — ~42 hours with zero merges as of this run. Nothing below this line is
  reachable by any agent desk until this clears.
- **The org's own institutional-memory pipeline is now the most acute symptom of the stuck queue,
  not a side effect.** PR #333 (the 2026-07-26 board memo) is **7 days old, still open, still
  draft** — its own append-only correction section claimed it "gets merged with `main`," which is
  false as of this run. PR #357 (2026-07-27 retro) is 6 days open; PR #364 (finance run 7) is 5
  days open; PR #373 (the ADR-0009 violation revert + `Auto-merge: off` flip) is **4 days open**,
  confirmed directly this run (`mergeable_state: behind`, still unresolved) — meaning `main`
  currently still reads `Auto-merge: on` despite an admitted, uncorrected governance violation.
- **Confirmed`, no new signal: zero confirmed-`Regular`-traffic conversions.** This run's own
  PostHog pull (14d, `signed_up`/`first_program_added`/`outclick`, filtered to `$virt_traffic_type
  = Regular`): every nonzero read this window (7/26–7/31: 1 `outclick`×several days, 1 `signed_up`
  + 1 `first_program_added` on 7/30) is **100% `Automation`-classified**, 0% `Regular` — same
  false-positive pattern the funnel-log has now caught 5+ times. Zero real conversions confirmed
  across the entire window since instrumentation shipped 2026-07-05, now 28 days.
- **Traffic (7d, `$host=hop.flights`, `filterTestAccounts: true`, pulled this run)**: 10 visitors,
  76 views, 14 sessions, 163s avg session, 35.7% bounce. In line with the last several reads
  (7–10 visitors/week) — flat at a very thin baseline, not declining further, not recovering.
- **Seats.aero (N-320) has been silent 27 days** (outreach sent 2026-07-06) — recomputed directly
  from the ledger's own date, not restated from a prior memo's count.
- **Design-system PRs kept landing into the stuck queue this week** — #378–382 (Card/Eyebrow/
  TierChip callsite migrations), 5 PRs in ~19 hours, directly against last week's own kill-list
  vote to hold new PR creation from that desk until the pipeline is confirmed clear. See §(d)
  amendment #9 and the explicit deprioritization in §(e).

## (c) Competitive / market read this week

Budget ~25 min via Exa. More material than a quiet week — three independent threads sharpen,
not just repeat, last week's read:

- **Seats.aero — hop's own data landlord — is shipping on a weekly cadence while the commercial-
  terms email sits unanswered 27 days.** In the last two weeks alone: a Google Flights Chrome
  extension showing award pricing inline (7/20,
  [TPG](https://thepointsguy.com/news/seats-aero-chrome-extension-google-flights/)), a redesigned
  search UI with new sort/filter tools rolling out to "all users by early August" — i.e. landing
  right now
  ([Frequent Miler](https://frequentmiler.com/seats-aero-adds-google-chrome-extension-cardmember-pricing-more/),
  7/20), cardholder-exclusive pricing expanded to all Pro members (United/Delta,
  [Upgraded Points](https://upgradedpoints.com/news/seatsaero-discounted-cardholder-pricing/),
  7/27), and three new premium-cabin finder tools (Air Canada eUpgrades, Cathay Pacific, Singapore
  Advantage,
  [Upgraded Points](https://upgradedpoints.com/news/seats-aero-new-premium-award-finding-tools/),
  7/29). This is not a company distracted from hop's category — it's the single most actively
  investing player in it, and it is also hop's unlicensed data supplier and the entity a
  written-terms request has been waiting on for 27 days.
- **Gondola MCP (`gondola-ai/gondola-mcp`, flagged as "very early, 6 stars" last week) has matured
  into a real, discoverable, broader-scope competitor to hop's MCP bet.** Now listed on the
  official MCP Registry, PulseMCP, Glama, and Smithery; a one-line Claude Code plugin install
  (`/plugin marketplace add gondola-ai/gondola-mcp`); 34 tools; fully anonymous search (no
  account, no API key) with cents-per-point valuations and loyalty-balance tracking behind OAuth;
  and — unlike hop's flights-only MCP — covers hotels, flights, *and* rental cars
  ([gondola.ai/mcp](https://www.gondola.ai/mcp), [GitHub](https://github.com/gondola-ai/gondola-mcp)).
  This is now the closest, best-packaged match to hop's "balances + computed cpp + MCP" pitch
  found in any scan this desk has run, and it already sits in the same discovery surfaces
  (registries, PulseMCP, Smithery) hop's own `/mcp` page has not yet been submitted to. It does
  not by itself invalidate hop's MCP bet — anonymous, zero-friction search is a real UX advantage
  hop's Bearer-token model doesn't match either — but the "first mover in agent-native
  distribution" framing from three weeks ago no longer holds; hop is now behind, not early.
- **point.me's TPG partnership (flagged 7/19) is an ongoing distribution channel, not a one-time
  launch bump** — the 4-months-free offer is still live and TPG-promoted; no new feature news this
  week, the wave from 7/16 has settled, consistent with the 7/26 read.
- **PointsYeah Wallet (beta, launched 2026-07-02) auto-syncs Chase/Citi/Amex balances** — direct
  feature-parity overlap with hop's balances-resolver core value prop, from a free competitor.
  Not new information (named in passing 7/26) but worth stating plainly: balance-aware search is
  now table stakes across point.me, PointsYeah, and Award Travel Finder — it stopped being a hop
  differentiator months ago. hop's actual remaining edges are the *computed, first-party-observed*
  cpp (see §(a)) and the concierge/MCP surface, not "we know your balance."
- **Devaluation wave continues, sharper than the 7/19 read**: Amex further cut its Netherlands
  Flying Blue ratio (5:4 → 8:4, an additional ~38% haircut on top of the US 1:0.75 cut already
  logged), Chase moved Hyatt to a 4:3 ratio for Sapphire Preferred/Ink Business Preferred (Sapphire
  Reserve still 1:1 — the first tiered-by-card-level transfer ratio seen), and Citi cut Emirates
  transfers 20% effective 7/27
  ([InsideFlyer](https://www.insideflyer.com/posts/transferable-points-lose-value-across-major-issuers/),
  7/26). This is exactly the kind of change a live observed-cpp pipeline should be catching before
  a hand-written blog post does — which is the whole case for shipping §(a)'s finding publicly
  now, not banking it as a future differentiator.

**Net read**: hop's two remaining structural bets — observed-cpp data and MCP-native distribution
— are diverging in opposite directions this week. One (observed-cpp) is quietly further along
than last week's board thought and completely unshipped. The other (MCP distribution) is
measurably further behind than three weeks ago, with a better-packaged, broader-scope, easier-to-
install competitor now sitting in the exact discovery surfaces hop hasn't reached yet. Neither
conclusion changes this week's ranked priorities (the merge pipeline blocks all of it regardless)
but both sharpen *why* amendment #7 (ship the observed-cpp page) deserves to move up once the
pipeline clears, and *why* the MCP-directory-submission freeze (kill list, carried since 7/19)
is getting more expensive to hold every week it continues.

## (d) Reprioritization for the coming week

**Adopting the 2026-08-02 board memo's ranked list (`docs/board/2026-08-02-board-memo.md` §7,
read from unmerged PR #383) as the baseline, with one sharpening based on new evidence this run
resolved.** No independent reordering of the founder-gated items — this run's evidence confirms
rather than contradicts the board's read on all of them.

The board's top items, restated with this run's confirmation/refinement:

1. Resolve PR #373 (revert the ADR-0009 violation, decide `Auto-merge` on/off) — confirmed still
   open, 4 days, unchanged. **[needs-founder]**.
2. Build a mechanical "pipeline is actually clear" check before any desk cites it as fixed again
   — confirmed the exact failure mode (a memo's own prose claiming "merged" while still open) is
   real and current. **[agents-can-execute]**.
3. Reply to seats.aero or flip billing off — 27 days silent (recomputed this run), sharper given
   §(c)'s finding that the landlord is shipping weekly while the request sits unanswered.
   **[needs-founder]**.
4. Reset or explicitly reaffirm the 2026-08-05 MRR target — 3 days remain as of this run, Wk1 gate
   has never fired, 28 days of zero confirmed-`Regular` conversions (confirmed again this run, no
   change). **[needs-founder]** for the decision.
5. Reconcile `docs/ops-runbook.md`'s R0.2 self-contradiction — confirmed directly this run: line 30
   ("still owed: one real test purchase end-to-end") vs. line 394 ("Single tested Stripe lane with
   real purchase (R0.2) — **Passed**"), same file, two different answers. **[agents-can-execute]**
   to fix the doc's internal consistency; **[needs-founder]** to supply which claim is actually true.
6. Build N-386 (fallback award-data source prototype) — still zero code, confirmed again.
   **[agents-can-execute]**.
7. **Sharpened this run, not just carried forward**: the board listed this as "verify
   `HOP_ENABLE_VALUATION_SYNC` is live [needs-founder to check Vercel], then ship a page if so
   [agents-can-execute]." This run's §(a) finding (three independent, converging code-level
   signals) makes the "is it live" question answerable with reasonable confidence *without*
   Vercel dashboard access. Recommending this move up to a **near-term agents-can-execute** item
   once the merge pipeline clears — ship a page surfacing the observed per-program cpp drift data
   already accumulating, framed honestly (first-party observed data, not a guarantee) per the
   copy-spec's normal rules. A full Vercel-dashboard confirmation is still worth doing when
   convenient, but shouldn't gate starting the build.
8. Backfill `docs/finance/outreach.md`'s approval-log entries — confirmed still open, 27 days.
   **[agents-can-execute]** mechanically; **[needs-founder]** for the underlying fact.
9. Freeze new design-system/self-improve PR creation until #2's check passes — confirmed actively
   violated this week (5 PRs, #378–382, into a queue that has now stalled a third time). See the
   explicit deprioritization below.
10. Post the 3 ready-to-paste community drafts — 27 days, zero agent substitute. **[needs-founder]**.
11. Grant finance desk DB/Stripe read access or explicitly pause it — ledger's last merged entry
    is 2026-07-14, now 19 days stale; its would-be run-7 entry is itself stuck in unmerged PR #364.
    **[needs-founder]**.
12–15. Funnel-log cadence, N-387, `llmCostUsd`, cron ordering — no new evidence this run changes
    any of these; carrying forward as the board ranked them.

## (e) Explicit deprioritization this week

**Deprioritizing further design-system component migration (Card/Eyebrow/TierChip callsite
sweeps) below N-386 and the observed-cpp page, for as long as the merge pipeline stays fragile.**
Reasoning: this work produced 5 PRs in 19 hours this week alone, directly against a freeze the
board voted for exactly one week ago; it is pure internal polish with zero users to serve
(consistent with the original 2026-07-05 board memo's "vanity/internal-tooling work consuming
agent time with zero users to serve" finding, which this pattern is a recurrence of, not a new
problem); and every PR it opens adds queue depth that a stuck pipeline cannot clear, directly at
the expense of PRs — the fallback award-source prototype, the observed-cpp page — that would
actually move a board-ranked, revenue-adjacent item. This is not a permanent kill, only a hold:
once the pipeline check in amendment #2 confirms real green merges again, design-system work can
resume at its normal priority.

**Also deprioritizing**: the funnel-log's 3x/week cadence, per the board's own §4 proposal — this
run's data shows the same "flat, thin, mostly-automation-flagged" pattern for the 6th+ consecutive
read; a weekly cadence would lose no real signal at current traffic levels and frees growth-desk
cycles for N-386 or the observed-cpp page instead.

## MRR-gate status (unchanged in substance, sharper on the calendar)

Wk1 gate ("payment path proven, one real stranger pays") is **not met, and — 3 days before the
2026-08-05 target — not reachable in the time remaining.** N-320 unstarted 27 days; 28 consecutive
days of zero confirmed-`Regular` conversions; the board's own amendment #4 (explicitly reset or
reaffirm the target) is still open. This desk does not have the authority to reset the target and
is not doing so here — restating the calendar fact plainly because 3 days is inside the window
where continuing to carry an unqualified "$10k by 2026-08-05" goal in agent-facing docs risks
being read as a live, achievable planning input by the next session that opens `docs/agent-
playbook.md`, when the evidence says otherwise.
