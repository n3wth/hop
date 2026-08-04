# hop weekly strategy review — 2026-07-26

Marcus, strategy desk. Baseline: `docs/board/2026-07-26-board-memo.md` (open in PR #333 at the
time of this run, not yet merged — see the process note in §(e)). Per `docs/agent-playbook.md`'s
ownership order, the board's ranked amendment list wins on any conflict, and this week's board
review is dated *today* and already reflects a full adversarial pass — this review adopts it as
the baseline and checks whether this run's own data (a fresh PostHog pull, a fresh Exa market
scan) contradicts or reorders it. It doesn't. This run's job is to confirm, sharpen, or add —
not re-derive a competing ranking.

## (a) What's working

- **The content-pipeline freeze is holding clean for a second straight week.** `git log
  --since=2026-07-20 -- app/guides app/sweet-spots` is empty, confirming the board's own read —
  the first time either half of the freeze (content or admin/nav polish) has held across two
  consecutive reviews without a violation.
- **The funnel-log's self-correction discipline is real and continues to hold.** The 2026-07-22
  entry caught and downgraded a false-positive "first signup" by checking `$virt_traffic_type`
  before reporting it — this run's own PostHog pull (see §(b)) confirms that same 7/18 event is
  still the only nonzero `signed_up`/`first_program_added` read in 21 days of data, and it is
  still `Automation`-classified, not a real conversion. No new false positive this run.
- **`/pricing`'s metadata-gating fix (PR #304) is holding** — no PR in this week's queue touches
  the price or the billing-flag gate; the single-source-of-truth pattern the board's double-downs
  list names is intact.
- **The board's own follow-through count improved this week**: 2 of 15 amendments closed cleanly
  (was 1 of 13 last week), plus a third genuinely *attempted* (PR #324, `/pricing` FAQ/JSON-LD) —
  the fleet is executing correctly on agent-doable work; what's changed is a new infrastructure
  fault is now eating that output before it lands (see §(b)).

## (b) What's stalled

- **The merge pipeline is still stuck, confirmed live at the time of this review, not just at the
  board's writing time.** Checked directly: PR #333 (this week's board memo, opened 13:15 UTC
  today) shows `Vercel: pending` as of this run with zero status update since creation; PR #331 (a
  real prerender-crash fix, opened 2026-07-25 18:29 UTC) is still `pending` **20+ hours later**.
  Nothing has merged to `main` since PR #317 (2026-07-23T10:48 UTC) — this review's own PR will
  land in the same stuck queue behind 14 other open PRs (#318–#333, two already closed unmerged).
  This is the single most important fact for anyone reading this file: **the ranking below is
  moot until the pipe clears**, exactly as the board's #1 ranked item says.
- **Traffic kept declining, not just flat.** This run's PostHog pull (7d, `$host=hop.flights`
  filtered, `filterTestAccounts: true`): **9 visitors, 38 pageviews, 13 sessions, 61.5% bounce
  rate, ~3.0 min avg session.** Visitors are flat vs. the 7/22 read (also 9), but pageviews are
  down (46→38) and bounce rate is markedly worse (40%→61.5%) — this is a weaker week than the
  already-thin baseline, not a stable floor.
- **New this run — a real, multi-day activity gap.** The 14-day funnel pull
  (`search_ran`/`verdict_viewed`/`signed_up`/`first_program_added`/`outclick`) shows **zero
  activity on every single event, four days running: 2026-07-23 through 2026-07-26 (partial)** —
  the first 4-consecutive-zero-day stretch across all five events at once since instrumentation
  shipped. The timing lines up with the merge-pipeline stall (also since 7/23) but there's no
  causal link — the site itself is live and unaffected by a stuck PR queue; this reads as the
  thin-traffic pattern getting thinner, coincidentally in the same week as the pipeline fault, not
  a symptom of it.
- **`signed_up`/`first_program_added` remain zero for confirmed-`Regular` traffic across all 21
  days logged since 2026-07-05.** The one nonzero pair (7/18) is unchanged from last week's read
  and still traces to `Automation`-classified traffic per the existing downgrade — not a new data
  point, just confirmed still-only-known-signal-is-not-real.
- **N-320 (seats.aero) is now 21 days silent, and this run's market scan sharpens the licensing
  risk this desk and the board have both already flagged — it does not newly prove hop is out of
  compliance.** Seats.aero's public developer documentation (see §(c)) states their policy plainly:
  a Pro API tier capped at 1,000 calls/day for personal/non-commercial use, and a separate written
  approval required for commercial/production use — exactly the approval hop's 7/6 email requested
  and has had no logged reply to in 21 days. This repo has no evidence of which tier/plan hop's own
  integration actually runs on or at what volume, so the honest framing is: a real, unresolved
  missing-approval blocker on a feed the paid product depends on, not a confirmed compliance
  verdict — the underlying risk is the same either way and doesn't need overstatement to matter.
- **The finance desk's silence is now 12 days (last entry 2026-07-14)**, confirmed unchanged by
  this run — no new ledger entry to check against.

## (c) Competitive / market read this week

Budget ~25 min via Exa. More material than a typical week, and it sharpens rather than repeats
last week's read:

- **point.me's 7/16 launch shipped with a distribution partnership, not just a feature drop**: The
  Points Guy is actively promoting point.me site/newsletter/social-wide with a 4-months-free offer
  — a real amplifier hop has no equivalent to. TPG's own review adds detail: multi-city search (up
  to 3 destinations, Premium-only for now), transfer-bonus expiry dates shown inline in results,
  sub-20-second searches. A more skeptical follow-up piece (Alertify, 7/17-18) notes real limits —
  Explore's map covers only 30 US origin airports and uses cached, not live, fares — worth knowing
  point.me's launch has real seams, not just polish. No further point.me news after ~7/18; this
  wave has settled. [TPG](https://thepointsguy.com/news/point-me-new-features/) (7/16).
- **PointsYeah quietly shipped the same "wallet" concept two weeks before point.me, with none of
  the press.** "PointsYeah Wallet (Beta)" (auto-syncing Chase/Citi/Amex balances) launched 7/2 —
  worth noting because it means *three* competitors (point.me, PointsYeah, and hop's own
  balances-resolver) have now converged on "show me my real points balance" as table stakes, not
  a hop differentiator alone.
- **New this run — a direct, MCP-native clone of hop's exact wedge appeared this week.**
  `gondola-ai/gondola-mcp`, created 2026-07-19 (this week), pitches "cash-vs-award travel search
  MCP... cents-per-point valuations" with 34 tools across Claude Code/Cursor/Windsurf/ChatGPT/
  Gemini CLI. Very early — 6 stars, 2 contributors — and not yet a real threat on traction, but
  it is the closest match found anywhere to hop's specific framing (cpp + balances + MCP), and it
  shipped in the same week hop's own MCP page had its named-competitor branding stripped for an
  unrelated compliance reason (see the board memo's §1 finding on commit `309de77`). Worth
  tracking, not yet worth reacting to.
- **Seats.aero — no AI-assistant news since June, but a concrete confirmation on the commercial-
  terms question that directly bears on N-320**: their own developer docs state the Pro API tier
  is capped at 1,000 calls/day for personal/non-commercial use only, with a separate written
  approval required for commercial/production use — exactly what hop's unanswered 7/6 email asked
  for. This confirms the *policy* is unambiguous, not that hop's own integration is confirmed
  in breach of it (no repo evidence here on which tier/volume hop actually runs) — but it does
  mean "waiting for a reply" is no longer a reasonable default; the policy already answers the
  question hop asked. Separately, Frequentmiler (7/20) reports seats.aero shipping a Chrome
  extension, a redesigned search UI, and cardholder-specific pricing for Pro members through early
  August — continued product investment from the vendor hop's award-data feed depends on.
- **Award Travel Finder — flat, not growing.** Its GitHub plugin still shows only 2 stars/0 forks,
  last pushed 4/27; it functions more as a daily content/newsletter operation than a growth
  story. No update to last week's "closest same-shape competitor" read, just evidence it isn't
  currently winning on adoption either.
- **Devaluation/transfer-partner churn continues at a normal pace** (Accor↔IndiGo BluChip
  partnership 7/17, Wyndham swapping rental-car partners 7/17, Axis Bank India reinstating Qatar
  Airways transfers 7/25) — routine content material for the observed-cpp thesis, not a new risk.
- **Fora (AI-assisted human travel agents) confirmed at $1B valuation** on its $60M Series D
  (TechCrunch, 7/16) — adjacent capital signal, still not a direct competitor to hop's
  computed-verdict wedge.

**Net read**: nothing this week reorders the fleet's priorities, but the trend across three
consecutive weeks of scans is now clear enough to say plainly: hop's "balances + computed cpp +
MCP" wedge is being independently reinvented by at least four different players (point.me,
PointsYeah, Award Travel Finder, and now Gondola MCP) at a pace faster than hop is shipping
distribution. The board's own finding this week that hop's observed-cpp differentiator
(`lib/valuations-live.ts`) is currently inert (`HOP_ENABLE_VALUATION_SYNC` unset) is the more
urgent read than any single competitor move — it means the one structural edge distinguishing hop
from a static "Good/Great" label is not actually running.

## (d) Reprioritization for the coming week

**Adopting the board's ranked list (`docs/board/2026-07-26-board-memo.md` §7) as-is — no
independent reordering.** This review's own data (the PostHog pull, the market scan) confirms
rather than contradicts it. Restated for reference, with this run's confirmation/refinement:

1. **Diagnose and unstick the frozen Vercel required-status-check.** Confirmed still stuck at the
   time of this review (checked PR #333 and #331 directly, both still `pending`) — nothing about
   this has resolved between the board's write-up this morning and this run this afternoon.
   Nothing below this line matters until it clears.
2. **Land the small, ready PRs first** (#331, #324, #325) once unstuck, before any new feature PR.
   Confirmed still the right order — no new evidence changes it.
3. **Hold new design-system/self-improve PR creation** until the pipeline is confirmed clear.
   Confirmed still open, still the right call given 13 PRs are already backed up behind a dead
   check.
4. **Start the fallback award-data-source prototype.** Confirmed still zero code, now sharper:
   this run's market scan confirms seats.aero's own published policy leaves no ambiguity about
   what written approval it requires (§(c)) — the single-vendor dependency this item mitigates is
   a real, unresolved missing-approval blocker, 21 days running, not just theoretical risk.
5. **Verify whether `HOP_ENABLE_VALUATION_SYNC` and the Cloudflare worker are actually live.**
   Confirmed by this run's market read as the more urgent framing than any competitor's move this
   week: if the observed-cpp differentiator is inert while four competitors converge on hop's
   wedge, that gap should close or stop being cited as an active edge — whichever is true, decide
   this week rather than carry the ambiguity into a fourth week.

**One addition, not a reorder**: this review directly verified the board's #1 finding is still
true as of this run (not just at the board's own write-up time this morning) — worth noting
because the gap between "the board found this at 13:00 UTC" and "is it still true at 15:00 UTC"
is exactly the kind of thing a stale finding could hide. It hasn't moved. Any session picking up
this queue next should re-check PR status before assuming any of #2–#5 above are reachable.

## (e) Process notes on this review itself

- **Linear was not reachable this session** (the MCP connector requires interactive OAuth,
  unavailable to a scheduled/headless run) — this review could not verify N-319/N-320/N-370's live
  Linear status, could not create/update Linear issues for the concrete moves below, and could not
  post this summary to the standing "Strategy desk — weekly market & priority review" Linear
  thread as instructed. Falling back to the git-only mode `docs/autonomy-runbook.md` describes for
  an unreachable Linear connector: the concrete moves this review would have filed are listed
  below instead, for the next Linear-connected session to create.
- **This review's own PR will queue behind the same stuck pipeline** described in §(b) — it may
  not merge (or even get a real CI signal) until the Vercel check issue clears, same as everyone
  else's PR this week. Flagging so a future reader doesn't mistake "this PR is still open" for
  this review having failed to run.
- **Concrete Linear moves that should exist once Linear is reachable** (filed here since this
  session can't create them directly):
  1. A **new, scoped issue**: "Diagnose stuck Vercel required-status-check blocking all `main`
     merges since PR #317 (2026-07-23)" — mirrors board ranked amendment #1, should be the single
     highest-priority open issue in the project until closed.
  2. **Split out or re-flag N-320's agent-buildable half** (the fallback award-data-source
     prototype) if it isn't already a standalone, non-owner-assigned issue — the 2026-07-19
     strategy review noted this was done that week; confirm it's still correctly split and not
     re-merged into the owner-blocked seats.aero issue.
  3. A comment on the standing "Strategy desk — weekly market & priority review" issue with this
     file's summary (§(a)–(d)) — queued for the next session with Linear access, verbatim below.

### Comment to post on the standing Linear thread (queued, Linear unreachable this run)

> **Strategy desk, 2026-07-26.** Adopting this week's board ranking as-is — no independent
> reorder; this run's PostHog pull and market scan confirm rather than contradict it. Two new
> facts worth flagging beyond the board's own memo: (1) directly re-checked PR #333/#331 this
> afternoon — the frozen Vercel check the board found this morning is still stuck, unchanged; (2)
> this week's market scan found a new MCP-native direct clone of hop's cpp+balances+MCP wedge
> (`gondola-ai/gondola-mcp`, created 7/19, very early/6 stars) alongside confirmation that
> seats.aero's own published docs require written approval for commercial use, unambiguously —
> the 21-day-unanswered email is a real, unresolved missing-approval blocker on that basis, not
> just a slow support queue (repo has no evidence on hop's actual tier/volume, so stopping short
> of calling it a confirmed compliance breach). Traffic kept declining this week (9
> visitors but bounce rate 40%→61.5%, and the first-ever 4-consecutive-zero-activity-day stretch,
> 7/23–7/26). Top priority remains unchanged from the board's list: unstick the merge pipe, then
> the fallback award-data-source prototype, then decide on `HOP_ENABLE_VALUATION_SYNC`'s actual
> live state. 10 days remain to the 2026-08-05 MRR target with the Wk1 gate (payment path proven)
> still unmet.

## MRR-gate status (unchanged, confirmed worse by the calendar)

Wk1 gate ("payment path proven, one real stranger pays") is **still not met and not reachable**:
N-320 (seats.aero written terms) unstarted, 21 days since the outreach email with no logged reply,
now further confirmed by this run's market scan that seats.aero's policy leaves no ambiguous path
around it. 10 days remain to the founder's 2026-08-05 $10k MRR target — since Wk1 was never met,
Wk2/Wk3/Wk4 gates were never reachable either; per the north-star plan's own Wk4 framing ("<$250
with launch executed = the board's kill-criteria question is live"), the honest read is that the
launch was never executed at all (the community drafts never posted), so even that kill-criteria
question hasn't had a chance to fire. The board's ranked amendment #10 (decide explicitly whether
to reset the target) remains open and is not this desk's call to make — restating it here because
10 days is now inside the range where the decision itself is time-sensitive.
