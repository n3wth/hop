# hop — Board Review Memo (2026-07-19)

## 1. State of the company

Real follow-through this week, for the first time on the two items the board itself ranked #1
and #2 last week: the PostHog host-filter bug (N-371, traffic was ~5x inflated by unrelated
hostnames) is fixed and closed, and the VerdictRail CTA fix (N-372, the diagnosed funnel bug) is
shipped and closed. Both are genuinely done, with commit/PR evidence, not just claimed.

But closing N-372 proved something worse than the bug it fixed: with the CTA corrected, `signed_up`
stayed at **zero for a 6th+ consecutive read**, and the funnel-log's own conclusion (2026-07-17) is
"the bottleneck is traffic, not the funnel — a conversion-copy fix has nothing to convert" at
14 hop.flights visitors/week. The org fixed the thing it could fix and confirmed the thing it can't
fix without the founder: two more ready-to-paste growth drafts have joined the pile (Show HN and
r/awardtravel, now **13 days** unposted; a third, MCP-directory submissions, added 2026-07-17
after all three attempted registrations hit auth/access walls this session couldn't clear
unattended).

Everything the board flagged as owner-blocked last week is **unchanged or worse**, now on its
**third consecutive week** for the oldest items: `HOP_ENABLE_BILLING` is still ON against an
unlicensed seats.aero feed, with zero reply to the 2026-07-06 commercial-terms email (13 days,
N-320 still Backlog, `startedAt: null`); `/pricing` (N-319) is still "In Progress" with **zero
commits** against `app/pricing/page.tsx` since 2026-07-12 (13 days since the board's own
finish-or-kill vote); GitHub Actions billing has been broken for 10+ days (unattended fleet
self-certifying every merge on local checks + Vercel preview alone); the finance desk has gone
silent for 5 days having never once produced a DB-verified subscriber count, even zero, across 6
ledger entries. New and worse this week: the strategy desk's market scan (2026-07-12) turned the
board's own "is seats.aero a competitor" contested point from last week into a confirmed fact —
seats.aero shipped its own AI redemption assistant in June, and a funded competitor
(Award Travel Finder) already has a live MCP endpoint + Claude plugin shipping hop's exact
"balances + AI + MCP" pitch — while hop's own agent-buildable mitigation (a fallback award-data
source, named in the business plan's own risk table) still has **zero lines of code**, despite
being flagged in two consecutive board memos.

One new process finding, not a repeat: the board's own standing Linear thread (N-370, "Board
review — weekly adversarial check") was marked **Done six seconds after being created** last week,
contradicting its own spec ("never mark Done — perpetual thread"). This review had to reconstruct
last week's state from the memo file rather than a live thread. Flagged below as an amendment.

Also two more content pages shipped since the board's 2026-07-12 kill-list vote #2 ("no further
content-pipeline expansion until a staleness guard exists") — a cpp-methodology explainer (PR #288)
and a Points 101 guide (PR #293) — with **no staleness guard built**, a second violation of the
same precondition in two weeks.

## 2. Follow-through on last week's amendments — what actually happened

| # | Amendment (2026-07-12 memo §7) | Status this run |
|---|---|---|
| 1 | Fix board/strategy cron ordering | **Not done.** `docs/team/routines.md` still shows board `0 13 * * 0`, strategy `0 15 * * 0` — unchanged, 2nd week flagged. |
| 2 | Resolve `/pricing`'s stalled state | **Not done — worse.** Zero commits against `app/pricing/page.tsx` since 2026-07-12. Metadata (`title`/`description`) still publicizes `$49/yr` unconditionally — it's a static `export const metadata`, not `generateMetadata()`, so it is never gated on `isBillingEnabled()` (the page *body* does degrade correctly; the `<head>` does not). |
| 3 | Ship the VerdictRail CTA fix | **Done** — N-372 closed 2026-07-17, `showAccountNudge` shipped via PR #286, verified against current `components/VerdictRail.tsx`. Produced zero new signups against a 14-visitor/week baseline. |
| 4 | Content staleness guard before further guides | **Not done, and violated twice more.** PR #288 (7/13) and PR #293 (7/15) both shipped after the 7/12 13:14 kill vote. The only "staleness" mechanism found (`CONTENT_LAST_MODIFIED` in `lib/seo-routes.ts`) is a single global sitemap `lastmod`, not a per-page "verified as of" guard. |
| 5 | Submit `/mcp` to 2-3 MCP directories | **Attempted, blocked.** Smithery (auth-gated CLI), PulseMCP ("no longer accepting submissions"), mcp.so (403 / GitHub issue outside `n3wth/hop` scope) — none completable unattended. Copy drafted to `docs/marketing/drafts/2026-07-17-mcp-directory-submissions.md`, unposted. |
| 6 | Prototype fallback award-data source | **Not started.** `grep` across `lib/` for a second award-availability source besides `lib/seatsaero.ts` returns nothing. Zero code, 2nd consecutive week flagged, and now sharper: the landlord risk it mitigates is confirmed, not hypothetical (see §1). |
| 7 | DB-verified subscriber count (even zero) | **Not done.** Ledger's last entry (2026-07-14, run 6) still reads "no DATABASE_URL or Stripe read access this session" — the same answer as all 5 prior entries. Desk has been silent 5 days since. |
| 8 | Fix GitHub Actions billing | **Not done.** `docs/ops-runbook.md`'s CI section (git-blamed to 2026-07-09) is unchanged; both workflows are still `workflow_dispatch`-only. 10+ days broken. |
| 9 | Confirm approval-log / flip-billing decision | **Not done.** No new decision logged from Oliver either way. |
| 10 | Decide on posting community drafts | **Not done.** Both original drafts (dated 7/6) are now 13 days unposted; a third joined the pile 7/17. |
| 11 | Add referrer/source-split to funnel log | **Not verified this run** — no lens found evidence either way. |
| 12 | Billing-gate-status line in ops-runbook.md (§3.1 cross-ref) | **Not done.** `grep` for "§3.1" or an explicit gate-status table in `docs/ops-runbook.md` finds nothing added. |
| 13 | Fold `llmCostUsd` into B3 panel | **Not done.** Still hardcoded `null` at `lib/unit-economics.ts:32,120`. |

**Net: 1 of 13 done, 1 partial-but-net-negative (content freeze violated again), 11 unchanged or
worse.** The one clean win (#3) is real, but it closed by disproving its own premise — traffic, not
conversion-copy, is the constraint — which the fleet responded to correctly (redirecting to
distribution) but is still structurally blocked on the same owner actions as before.

## 3. Consensus risks (2+ members)

- **Billing is live on an unlicensed, now-confirmed-competing feed, unresolved for a third
  consecutive week.** Subscription-economics, CFO, travel-industry, and product-skeptic all
  independently verified: N-320 is still Backlog (`startedAt: null`), 13 days since the outreach
  email with no logged reply, and the risk it was meant to catch — seats.aero being a direct
  competitor with reduced incentive to grant favorable terms — is now a confirmed fact (its own AI
  redemption assistant, shipped ~June, per the strategy desk's market scan), not a hypothesis.
- **`/pricing` (N-319) is in the worst possible state — neither finished nor frozen — for a third
  week, with a new concrete defect.** Subscription-economics, product-skeptic, and CFO's kill list
  agree: zero commits since 7/12, `app/pricing/page.tsx`'s `metadata` export is static and
  unconditional (not gated on `isBillingEnabled()`), so the page's `<head>`/social-preview always
  advertises `$49/yr` regardless of whether billing is even on — a real, previously-unflagged
  inconsistency, not just a stale status label.
- **The fallback award-data-source prototype is the cheapest available risk reduction on the
  board and has zero code, two weeks running.** Travel-industry and product-skeptic both flag it
  as agent-buildable (not owner-blocked) yet still untouched, now sharper given the confirmed
  competitor risk it mitigates.
- **The finance desk cannot answer the one question that matters, and has now gone quiet doing
  so.** CFO and product-skeptic both confirm: 6 ledger entries, zero DB-verified subscriber counts
  (even zero), 5 days silent since the last entry — this is a permissions/access gap, not a
  discipline gap, per the CFO's read.
- **The distribution lever is the only thing left that could move the funnel, and it's stuck on a
  13-day-old owner action.** Growth operator, CFO, and travel-industry all independently converge
  on the same fact from different angles: the community drafts (now 3 of them) sit unposted with
  zero agent substitute, while the funnel itself is confirmed traffic-starved, not
  conversion-starved.
- **GitHub Actions CI has been broken for 10+ days on an unrelated account-payment issue.** CFO
  and product-skeptic both flag this as a real operational risk: an unattended fleet has been
  self-certifying every merge on local `npm run check` + Vercel preview alone, on a codebase that
  touches payments.

## 4. Contested points (no false consensus)

- **What is the single highest-priority fix this week?** Three lenses nominate three different
  answers, and none contradicts the others so much as competes with them for the same queue slot:
  product-skeptic's kill list puts `/pricing` (finish-or-freeze) as the unconditional top action;
  travel-industry argues the fallback-award-source prototype should jump ahead of both `/pricing`
  and content work given the now-confirmed competitor risk; CFO's framing is that neither matters
  much until N-320 (the seats.aero decision) moves, since it gates both billing and the moat
  question. The board should pick one explicit top slot rather than let three legitimate asks
  compete silently.
- **Should the fleet keep doing agent-executable product/content work while owner-blocked items
  sit open, or freeze broadly until the founder acts?** CFO's kill list explicitly argues: "kill
  any further GTM/content investment... until N-320 moves — building demand for a product that
  legally can't collect payment is negative-value work right now." Growth operator and
  product-skeptic instead see specific agent-doable work as still legitimate right now — the
  staleness guard, the `/pricing` metadata fix, the referrer-split instrumentation — treating a
  broad freeze as itself a missed-execution risk. The board should decide whether "one unit of
  work per run" should currently mean "keep shipping the queue" or "hold everything non-owner-
  blocked pending the founder's seats.aero/billing decision."
- **Is the $99/yr price-raise gate meaningfully "in progress," or should it stop being tracked
  that way?** Subscription-economics flags that one of its three conditions (alerts firing
  reliably 60+ days) cannot even start its clock while billing stays off — no other lens directly
  disputed this, but it wasn't independently corroborated either; flagging as contested-by-
  omission rather than confirmed consensus.

## 5. Kill list (board would vote for)

1. Resolve `/pricing` this week, no further ambiguity: either gate `app/pricing/page.tsx`'s
   metadata via `generateMetadata()` behind `isBillingEnabled()` and finish FAQ/JSON-LD, or
   revert/`noindex` the route and flip N-319 back to Backlog to match reality. Third week carried;
   the metadata-gating gap is new evidence this is worse than a status-label problem.
2. No further `/guides/[program]`, sweet-spot, or methodology-page content until a real per-page
   "verified as of" staleness guard exists — this is now a second violation of the board's own
   7/12 vote (PR #288, PR #293), not a first offense.
3. No further `/mcp` page polish until at least one MCP-directory submission actually lands —
   carried forward, unchanged; a funded competitor already has the plugin listing hop is still
   drafting copy for.
4. Stop tracking the $99/yr raise-gate as "in progress" anywhere — it is blocked-on-billing by
   construction until N-320/N-321 clear; mark it explicitly blocked instead.
5. Stop scheduling the finance desk to produce a 7th identical "no DB access" ledger entry —
   either grant read-only DB/Stripe read access this week, or explicitly pause the desk rather
   than let it keep reporting the same unknown.

## 6. Double-downs

- **The observed-cpp telemetry pipeline (`lib/valuations-live.ts`)** — travel-industry's read:
  the one differentiator competitors (seats.aero's own assistant, Award Travel Finder, and
  content sites like Daily Drop/Platinum Flyer) structurally don't have, since it's first-party
  observed data, not another LLM wrapper over the same upstream feed.
- **The fallback award-data-source prototype** — travel-industry and product-skeptic both name it
  the cheapest available de-risking still sitting untouched; should move up the queue this week.
- **Posting the 3 ready-to-paste drafts (Show HN, r/awardtravel, MCP directories)** — growth
  operator, CFO, and travel-industry converge: zero agent substitute, ~5 minutes of founder time,
  longest-open item on any board list (13 days for the oldest two).
- **`lib/pricing.ts`'s single-source-of-truth pattern and the free/Pro cap design** —
  subscription-economics: clean, already fixed a prior displayed-vs-MRR-assumed price drift bug;
  no action needed, just don't regress it while fixing the metadata-gating issue above.
- **The funnel-log's own self-correction discipline** — product-skeptic: the 7/15 entry caught and
  fixed its own premature "Points 101 shipped" claim in-band before the next entry; genuine
  self-policing worth reinforcing as the house standard.

## 7. Ranked amendment list

1. Gate `app/pricing/page.tsx`'s `metadata` export via `generateMetadata()` behind
   `isBillingEnabled()` so it stops publicizing `$49/yr` regardless of billing state — cheap,
   concrete, closes a real newly-found inconsistency. **[agents-can-execute]**
2. Resolve N-319 fully this week per kill-list item 1 above (finish or revert/freeze). The
   underlying "flip billing off vs. accept exposure" call is **[needs-founder]**; the finish-or-
   revert mechanics are **[agents-can-execute]**.
3. Start the fallback award-data-source prototype (N-320's agent-buildable half) — currently pure
   backlog rot with zero commits despite being named in two consecutive board memos and now
   mitigating a confirmed, not hypothetical, competitor risk. **[agents-can-execute]**
4. Build a real per-page "verified as of" staleness guard before any further content ships, and
   enforce it via reviewer checklist rather than memo language — the actual precondition the board
   voted for two weeks ago, still missing, now violated twice. **[agents-can-execute]**
5. Reopen Linear N-370 (mark not-Done / In Progress per its own "perpetual thread" spec) and fix
   whatever board-routine step closed it 6 seconds after creation — a process bug that breaks the
   board's own institutional memory across weeks. **[agents-can-execute]**
6. Fix the board/strategy-desk cron ordering (`0 13 * * 0` vs `0 15 * * 0`) — unfixed for a 2nd
   week running. **[agents-can-execute]**
7. Add the billing-gate-status line to `docs/ops-runbook.md` cross-referencing business plan
   §3.1's four gates — carried 2nd week, still not done. **[agents-can-execute]**
8. Fold `llmCostUsd` into the B3 unit-economics panel — carried 2nd+ week, still hardcoded `null`.
   **[agents-can-execute]**
9. Add referrer/source-split data to the funnel log before drawing further conclusions from
   traffic reads — carried forward, still open. **[agents-can-execute]**
10. Stop implying the $99/yr raise-gate is "in progress" in any tracking doc — mark it explicitly
    blocked-on-billing until N-320/N-321 clear. **[agents-can-execute]**
11. Reply to seats.aero (N-320) or make the "flip billing off" decision explicitly — 13 days
    unanswered, the single hardest blocker on the entire northstar. **[needs-founder]**
12. Post the 3 ready-to-paste drafts (Show HN, Reddit, MCP-directory submissions) — 13 days for
    the oldest two, zero agent substitute possible. **[needs-founder]**
13. Fix GitHub Actions billing (personal payment method) — 10+ days broken, unattended fleet
    self-certifying merges on local checks + Vercel preview alone. **[needs-founder]**
14. Grant the finance desk read-only DB/Stripe read access, or explicitly instruct it to stop
    running until access exists — 5+ days silent, 6 identical "unknown" entries. **[needs-founder]**
15. Decide explicitly whether to reset the Aug-5 $10k MRR target given N-320 hasn't moved in 15
    days and 17 days remain — an explicit reset call, not the fleet quietly continuing to plan
    around a target that may already be dead. **[needs-founder]**

## 8. Questions for the founder (verbatim, one per lens)

1. "The seats.aero email has sat unanswered 13 days and a competitor already ships hop's exact
   wedge — do you want `HOP_ENABLE_BILLING` off today, or are you deliberately holding the $10k
   MRR/8-5 northstar against a revenue path only you can unblock?"
2. "Given seats.aero is now a confirmed direct competitor shipping a superset of hop's engine, and
   the fallback award-source prototype your own plan calls the kill-criterion has had zero code
   for two weeks — do you want that prototype pulled ahead of `/pricing` and content work in the
   queue this week, or are you accepting single-vendor award-data risk indefinitely while billing
   stays gated on their reply?"
3. "Will you personally send the seats.aero reply/fix GitHub Actions billing this week, or should
   the fleet stop treating Aug 5 as a live target and start planning around whenever N-320
   actually clears?"
4. "The Show HN and Reddit drafts have been ready since July 6 — 13 days, the single act every log
   entry calls the highest-leverage thing undone. Will you post them this week, or should the
   fleet stop re-flagging this and mark community seeding paused?"
5. "N-319 has now sat 'In Progress' for 13 days with zero commits while its live page still
   advertises a price — do you want it finished, frozen, or reverted this week, one way or the
   other?"

Three of the five questions, asked independently by five agents with no shared context, converge
on the same underlying ask: **the seats.aero/billing decision and the `/pricing` decision are now
the two oldest open items on any board list, and both require five minutes of founder time to
resolve one way or the other.**
