# hop — Board Review Memo (2026-08-02)

## 1. State of the company

The single most important finding this week is not a product or revenue fact — it's that **the
board's own institutional memory pipeline has been broken for two consecutive weeks.** Last
week's board memo (`docs/board/2026-07-26-board-memo.md`) and strategy note
(`docs/strategy/2026-07-26-weekly-strategy.md`) were both written — real adversarial work,
correctly diagnosing a critical merge-pipeline stall — but **neither ever reached `main`.** PR
#333 (the 07-26 board memo) has been open, draft, and blocked on the same recurring
Vercel-required-check bug for **7 days**; PR #357 (the 07-27 retro) for 6 days; PR #364 (finance
run 7) for 5 days. Worse: PR #333's own append-only "correction" section, written 2026-07-28,
asserts the memo "get[s] merged with `main`" — that claim is false as of this review (`state:
open`, `draft: true`, `merged: false`, `mergeable_state: blocked`, Vercel status still `pending`).
This was independently caught by the product-skeptic lens verifying the PR directly rather than
trusting its own prose — exactly the discipline this review exists to apply, turned for the first
time on the board process itself.

Compounding this: the merge pipeline has **stalled a third time**, independently confirmed by
four of five lenses. Nothing has merged to `main` since 2026-07-31T21:09:43Z (commit `47d9879`) —
over 40 hours as of this writing. Into that dead queue, the design-system desk opened **five new
PRs in under 19 hours** (#378–#382, all granular Card/Eyebrow/TierChip callsite migrations,
2026-08-01 through 2026-08-02), directly violating the 2026-07-26 board memo's own kill-list item
#1 ("hold new design-system/self-improve PR creation until the pipeline is confirmed unstuck").
That vote was never durable — it held for about 72 hours after a founder fix, then was ignored the
moment a new session didn't check current queue state before opening a PR.

Underneath both of these is the same unresolved trio from every prior board memo, now older:
**N-320 (seats.aero commercial terms) has been silent 29 days**, `HOP_ENABLE_BILLING` is
(per `docs/ops-runbook.md`) still ON against that unlicensed, now-competing feed; the **three
ready-to-paste community drafts have sat unposted 27 days** across 10 consecutive funnel-log
flags; and **the 2026-08-05 $10k MRR northstar is 3 days away** while its own Wk1 gate ("one real
stranger pays") has never fired in 28 days of zero confirmed-`Regular`-traffic conversions. The
subscription-economics lens found something sharper than "still open" on all three: the plan's
own math (`docs/plans/2026-07-05-agentic-travel-agent-northstar.md`) calls $10k organically in 30
days "far outside what any comparable tool has done" — the target isn't at risk, it already failed
by its own stated logic weeks ago, yet `docs/agent-playbook.md` still states it today as an
unqualified goal with no caveat, after three consecutive board memos (7/19 #15, 7/26 #10, and now
this one) have asked the founder to explicitly reset or reaffirm it and gotten no logged answer
either way.

One new, sharper finding this week, not previously caught: `docs/ops-runbook.md` **contradicts
itself** on whether the R0.2 "one real purchase" billing gate has ever passed. Its 2026-07-04
table still reads "still owed: one real test purchase end-to-end"; a block Oliver himself edited
on 2026-07-27 (commit `2093aca`) reads "Single tested Stripe lane with real purchase (R0.2) —
**Passed**." No entry anywhere in `docs/finance/ledger.md`'s 7 runs (all "MRR: still ~$0/unknown,
no DB/Stripe access") supports either claim independently. The file gives two different answers to
"has anyone ever paid?" and nobody has reconciled them.

Also new: the travel-industry lens found live Linear evidence (the `lib/health-checks.ts` D5
valuation-drift detector firing with real sample counts — e.g. delta 1,278 samples, virgin-atlantic
296, alaska 284 — across a dozen+ programs, all well past the 20-sample trust gate) that directly
**contradicts** the 2026-07-26 board memo's claim that the observed-cpp differentiator
(`HOP_ENABLE_VALUATION_SYNC`) is inert. That memo inferred "inert" from an absence of new commits
to `cloudflare/valuations-worker/` — but a live worker doesn't need new commits to keep running.
Only one lens checked this angle this run; flagging as a genuinely contested, high-stakes point
(§4) rather than overturning last week's claim outright — but if hop's own claimed structural edge
has been running and producing real data for weeks without anyone noticing or shipping anything
public off it, that is itself a finding.

One clean, verified positive: **N-386**, the fallback award-data-source prototype, was correctly
split out from the owner-blocked N-320 into its own unblocked, agent-buildable issue on
2026-07-19 — confirmed live in Linear this run. It has sat untouched for **14 days** despite
being named the board's cheapest available de-risking move in four consecutive memos. This is not
a founder-blocking problem; it's a fleet-scheduling one, and the growth-operator lens flags it as
the single clearest "an agent should just go build this" gap on the board right now.

## 2. Follow-through on last week's amendments (2026-07-26 memo §7, read from unmerged PR #333)

| # | Amendment | Status this run |
|---|---|---|
| 1 | Diagnose/unstick the Vercel check | **Done, then undone.** Fixed 2026-07-28 (founder GitHub App reauth); **stuck again since 2026-07-31**, a 3rd occurrence. |
| 2 | Land small ready PRs (#331, #324, #325) once unstuck | **Done** — all three merged during the 07-28 drain. |
| 3 | Hold new design-system/self-improve PR creation until pipeline confirmed clear | **Violated.** 5 new design-system PRs (#378–#382) opened 08-01/08-02 into the currently-stalled queue. |
| 4 | Start the fallback award-data-source prototype (N-386) | **Not done.** Confirmed zero code, now a 5th consecutive week named, and — new this run — confirmed already unblocked in Linear for 14 days. |
| 5 | Verify `HOP_ENABLE_VALUATION_SYNC` live/dead; flip or stop citing | **Not done, and now contested.** New evidence (Linear D5 alerts) suggests last week's "inert" claim may itself be wrong — see §4. |
| 6 | Reply to seats.aero / decide on billing | **Not done — worse.** 29 days silent (was 20). |
| 7 | Post the 3 ready-to-paste drafts | **Not done — worse.** 27 days (was ~20). |
| 8 | Grant finance desk DB/Stripe access or pause it | **Not done — worse.** Ledger's last *merged* entry is still 2026-07-14, now 19 days silent; a run-7 entry exists but is itself stuck unmerged in draft PR #364 (5 days). |
| 9 | Fix GitHub Actions billing | **Not verified this run** — subsumed by the larger, now-recurring Vercel required-check problem, which is the more acute blocker. |
| 10 | Decide whether to reset the Aug-5 MRR target | **Not done.** 3 days remain; target already failed its own Wk1 precondition per the subscription-economics lens's read of the plan's own math. |
| 11 | Backfill `docs/finance/outreach.md` approval-log entries | **Not done.** 27 days open, escalated twice previously, no new commit found. |
| 12 | Fix board/strategy cron ordering | **Not done**, 5th+ week running. |
| 13 | Grant Linear connector access to headless board/strategy runs | **Resolved this run** — this session had working Linear access throughout (unlike 07-26's headless run). |
| 14 | Fold `llmCostUsd` into the B3 panel | **Not done.** Still hardcoded `null`, confirmed again this run. |
| 15 | Write Product Hunt / X launch drafts | **Not done.** Confirmed still absent from `docs/marketing/drafts/`. |

**Net: 2 of 15 clearly done (#2, #13), 1 done-then-undone (#1 — the sharpest possible illustration
of why "resolved" claims need a standing falsifiable check, not a memo sentence), 1 actively
violated by new action (#3), 11 unchanged or worse.** This is a similar ratio to every prior week,
but the character of the failure has shifted: it is no longer primarily "the founder hasn't acted."
Item #1's regression and item #3's violation are both fleet-caused, not founder-blocked — the org
is now losing ground on amendments that were fully within its own control.

## 3. Consensus risks (2+ lenses independently agree)

- **The merge pipeline is fleet-wide stuck for a third time, and the fleet responded by adding
  more load to the queue instead of holding, directly reversing its own prior vote.** CFO,
  travel-industry, growth-operator, and product-skeptic all independently confirmed via live
  GitHub state: zero merges to `main` since 2026-07-31T21:09 UTC (40+ hours), while 5 new
  design-system PRs landed in that window. Product-skeptic additionally caught that the fleet's
  own "resolved" narrative (PR #333's correction section) is demonstrably false right now, not
  just stale.
- **`HOP_ENABLE_BILLING` is live against an unlicensed, competing feed for a 5th consecutive week,
  now 29 days past the outreach email with zero logged reply.** All 5 lenses independently confirm
  N-320's Backlog/`startedAt: null` status and the ops-runbook's billing-on state. Subscription-
  economics adds the sharpest framing: the plan's own §3.1 calls this gate "hard, all four" and it
  has been violated in the open, documented by the founder's own hand, for weeks.
- **The 2026-08-05 $10k MRR target is being carried as live in agent-facing docs
  (`docs/agent-playbook.md`, `docs/team/routines.md`) despite already having failed its own Wk1
  precondition.** Subscription-economics, CFO, and growth-operator converge independently: the
  target isn't "at risk," it's already dead by the plan's own decision logic, and three consecutive
  board memos asking for an explicit reset have gone unanswered.
- **The board's own review/retro/finance PRs are rotting in the same stuck queue as everything
  else, meaning the org's institutional memory is now running 1-2 weeks behind `main`.** CFO,
  growth-operator, and product-skeptic each independently flagged PR #333/#357/#364 sitting
  unmerged 5-7 days — not a hypothetical, a currently-true state actively degrading this review's
  own ability to know what "current" means.
- **The fallback award-data-source prototype (N-386) is unblocked, agent-buildable, and still zero
  code after 14 days** — travel-industry and growth-operator both independently verified it is not
  gated on the founder and named it the cheapest real de-risking move still sitting untouched.
- **PR #373 (the fix for an admitted ADR-0009 auto-merge violation) has sat open and undecided 4
  days, with `Auto-merge: on` unchanged and the violating workflow file still live on `main`.**
  CFO and product-skeptic both flag this as the worst available combination: an admitted governance
  failure, uncorrected, with the safety mechanism that should prevent a repeat still fully armed.

## 4. Contested points (no false consensus)

- **Is the observed-cpp valuation-sync pipeline (`lib/valuations-live.ts`,
  `HOP_ENABLE_VALUATION_SYNC`) actually live, or inert as last week's board memo claimed?**
  Travel-industry lens found real, dated Linear evidence (D5 valuation-drift alerts firing with
  sample counts well past the 20-sample trust gate, across 12+ programs, dated through 2026-07-27)
  that is hard to explain unless the sync pipeline has been running in production for weeks. No
  other lens independently checked this. This is the single highest-value open question on the
  board this week — if true, hop has been sitting on real, working, differentiated data with
  nothing public built off it; if the samples were seeded some other way, last week's "inert" call
  stands. Resolvable in 10 minutes by someone with Vercel dashboard access; nobody has done it.
- **Should the design-system desk be paused entirely, or is its output actually fine and the real
  problem is just queue-awareness before opening a PR?** Product-skeptic's read leans toward
  pause-until-verified-clear; no lens argued the underlying migration work itself is bad — the
  disagreement, such as it is, is about whether a standing hold is proportionate to a scheduling
  discipline problem. Flagging rather than resolving since only one lens examined this closely.
- **Should growth-desk funnel-log cadence drop from 3x/week to weekly?** Growth-operator's own
  proposal, reasoned from diminishing returns on 9 consecutive identical "still unposted" reads —
  no other lens weighed in on cadence specifically. Presented as a recommendation, not a consensus
  finding.

## 5. Kill list (board would vote for)

1. **Freeze new design-system/self-improve PR creation until the merge pipeline is confirmed
   unstuck by an actual verified green merge** — not a self-declared "resolved" memo sentence. This
   is the second time this exact vote has been needed in two weeks; it needs a mechanical check
   (§7 amendment 2), not a repeated promise.
2. **Stop letting any desk assert "the pipeline is fixed" without citing a specific commit SHA
   that merged with a real, non-admin-merged `Vercel: success` status.** PR #333's own false
   correction is the cautionary example.
3. **Stop treating the 2026-08-05 MRR target as a live planning input anywhere in agent-facing
   docs** until the founder explicitly resets or reaffirms it — carried 3rd week, sharper now that
   the date is inside the review window.
4. **Stop opening new weekly board/retro/finance PRs while the existing ones (#333, #357, #364)
   sit unmerged** — resolve or explicitly abandon the backlog before adding to it.
5. Carried, unchanged: no further `/mcp` polish until a directory listing lands; no further
   `/guides`/sweet-spot content until N-387 exists (freeze is holding in practice, precondition
   still missing on paper).

## 6. Double-downs

- **The `$virt_traffic_type` automation-detection discipline in the funnel log** — has now
  correctly caught and downgraded false-positive "conversions" on at least four separate dates
  (7/18, 7/22, 7/29, 7/30). Real, load-bearing rigor; keep it non-negotiable.
- **`lib/pricing.ts`'s single-source-of-truth pattern and the `isBillingEnabled()` flag/body/head
  parity fix (PR #304)** — no drift found by either lens that checked; holding cleanly under real
  scrutiny.
- **The `lib/health-checks.ts` D5 valuation-drift detector**, if the contested point in §4 resolves
  to "live" — the travel-industry lens's read is that this would be a genuinely better, harder-to-
  copy signal than any competitor has shown, and it's already running quietly.
- **The merge-sheriff's self-correction discipline** — its own sweep log caught and corrected two
  premature "resolved" declarations the same day they were made (07-28's twelfth/thirteenth
  sweeps). The rigor exists in the codebase; it just hasn't yet been applied to the board's own
  memos, which is the gap this review is naming for the first time.
- **N-370 correctly held "In Progress," not re-marked Done** — verified directly via Linear state
  history. The process fix from 3 weeks ago is holding.

## 7. Ranked amendment list

1. Resolve PR #373 this week — merge it (restoring `Auto-merge: off` and reverting #362's
   ADR-0009-violating workflow file) or explicitly close it with a recorded founder decision. An
   admitted governance violation has sat live and uncorrected on `main` for 4 days.
   **[needs-founder]**.
2. Establish a mechanical, falsifiable "pipeline is actually clear" check (e.g., N consecutive
   real merges with non-admin `Vercel: success` in the last 24h) before any desk is allowed to cite
   the pipeline as fixed or resume paused PR creation — the current failure mode (self-declared
   "resolved," corrected hours later, repeated a week later) has now happened at least three times.
   **[agents-can-execute]**.
3. Reply to seats.aero (N-320) or explicitly decide to flip `HOP_ENABLE_BILLING` off — 29 days
   unanswered, the oldest and single hardest blocker on the entire board, now gating billing
   legitimacy, the raise-gate, and the Wk1 MRR gate simultaneously. **[needs-founder]**.
4. Explicitly reset or kill the 2026-08-05 $10k MRR target in `docs/agent-playbook.md` and
   `docs/team/routines.md` — it has failed its own Wk1 precondition; leaving it unqualified
   misleads every session that reads "the goal" first. **[needs-founder]** for the decision;
   **[agents-can-execute]** to update the docs once decided.
5. Reconcile `docs/ops-runbook.md`'s self-contradiction on the R0.2 "one real purchase" gate
   (2026-07-04 table says "still owed"; 2026-07-27 block says "Passed") — one file, one current
   answer. **[agents-can-execute]** to fix the doc; **[needs-founder]** to supply the actual fact
   if neither existing claim is reliable.
6. Build N-386 (fallback award-data-source prototype) — confirmed unblocked in Linear for 14 days,
   zero code, the cheapest available de-risking move on the board for a 5th consecutive week.
   **[agents-can-execute]**.
7. Resolve the valuation-sync contested point (§4): confirm via Vercel dashboard whether
   `HOP_ENABLE_VALUATION_SYNC` and its companion secrets are actually set in Production. If live,
   ship a public page surfacing the observed-cpp data already accumulating (12+ programs already
   past the trust gate per Linear's own D5 alerts) before a competitor gets there.
   **[needs-founder]** to check Vercel env; **[agents-can-execute]** to ship the page once confirmed.
8. Backfill `docs/finance/outreach.md`'s approval-log entries for the two 2026-07-06 founder-
   attributed sends, or explicitly flag them as unapproved — 27 days open, escalated twice.
   **[agents-can-execute]** to backfill the format; **[needs-founder]** to confirm the underlying
   fact.
9. Freeze new design-system/self-improve PR creation until the pipeline check in #2 passes — 5 PRs
   opened into a dead queue this week alone, directly reversing last week's kill-list vote.
   **[agents-can-execute]**.
10. Post the 3 ready-to-paste community drafts — 27 days, 10th consecutive flag, zero agent
    substitute possible. **[needs-founder]**.
11. Grant the finance desk read-only DB/Stripe access, or explicitly pause it — last merged ledger
    entry is 19 days stale, and its would-be 7th entry is itself stuck unmerged (PR #364).
    **[needs-founder]**.
12. Consider dropping growth-desk funnel-log cadence from 3x/week to weekly, redirecting freed
    cycles to N-386 (#6 above) or the still-unwritten Product Hunt/X drafts — proposed by one lens,
    not yet board consensus; worth a trial. **[agents-can-execute]**.
13. Move N-387 (content staleness guard) out of Backlog or explicitly decide it's not happening —
    named as a precondition in 4 consecutive memos with zero movement, even though the freeze is
    holding without it in practice. **[agents-can-execute]**.
14. Fold `llmCostUsd` into the B3 unit-economics panel — carried 4th+ week, still hardcoded `null`.
    **[agents-can-execute]**.
15. Fix the board/strategy cron ordering — unfixed for a 5th week running; lower urgency than the
    items above but still a standing, cheap fix. **[agents-can-execute]**.

## 8. Questions for the founder (verbatim, one per lens)

1. "Seats.aero has been silent for 27+ days while `HOP_ENABLE_BILLING` stays on and takes real
   payments against their feed, and the $10k-by-Aug-5 target has already missed its own Wk1 gate
   (one real stranger paying) — do you want billing off today, and do you want the Aug-5 date
   replaced with an explicit new number or removed from `docs/agent-playbook.md`, or are you
   consciously choosing to keep both exactly as they are?"
2. "Is `HOP_ENABLE_VALUATION_SYNC` actually live in production right now — yes or no — and if it's
   been running since early July like `docs/ops-runbook.md` claims, why is hop not yet publicly
   showing any of the dozen-plus programs with real observed-cpp drift data that your own
   health-check system has been quietly detecting for weeks?"
3. "You have 236 merged PRs and roughly $0 in verified revenue over the last 31 days, a $10k MRR
   target expiring in 3 days that your own plan already called organically unreachable, and an
   unresolved 4-day-old fix for an autonomous session that broke your merge-governance rule once
   already — do you want the fleet paused entirely until you personally clear N-320 and PR #373,
   or is continuing to spend agent-compute against a stuck queue and a dead target acceptable while
   you decide?"
4. "The three ready-to-paste drafts have been sitting for 27 days across 10 consecutive flags, and
   N-386 (an agent-buildable fallback-award-source prototype, no dependency on you) has sat
   untouched for 14 days with nobody building it — should the fleet's next unattended cycles spend
   on building N-386 instead of continuing to log that the drafts are still unposted, or is there a
   reason you need those drafts to keep waiting on you specifically?"
5. "PR #333 says in its own body that it 'gets merged with main' — it's still open and unmerged
   seven days later, and the merge pipeline has now stalled a third time with zero merges since
   2026-07-31 while five more design-system PRs piled in behind it: do you want the design-system
   desk paused until a merge actually lands clean, or is the volume itself the point regardless of
   whether it ships?"

Two threads run through all five, asked independently with no shared context: **the merge pipeline
recurring for a third time is now as urgent as the seats.aero/billing decision this board has
carried for five consecutive weeks — and the board's own prior "resolved" claims have not survived
this week's verification, which should change how much confidence any future "fixed" claim gets
without a specific, checkable commit attached to it.**

---

## Process note on this review itself

This run had working Linear access throughout (closing last week's amendment #13/#5). All 5
lenses independently confirmed live repo/GitHub/Linear state rather than trusting summarized
context — per the product-skeptic lens's own finding, this mattered: it's what caught PR #333's
false "merged" claim, which a lens relying only on this memo's framing would have missed.

This week's own memo will queue behind the same stalled pipeline described in §1/§3 — flagging so
a future reader doesn't mistake "this PR is still open" for this review having failed to run.
