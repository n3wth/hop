# hop — Board Review Memo (2026-08-09)

## 1. State of the company

The institutional-memory pipeline that broke for two consecutive weeks (2026-07-26, 2026-08-02)
is now healthy — `git log origin/main` confirms both the 2026-08-02 board memo (PR #383) and the
2026-08-02 strategy note (PR #384) are merged, along with 44 further commits through
2026-08-07 (`aba8e7c`). That is real, if overdue, good news, and this review is the first in
three weeks that isn't opening by explaining why last week's memo can't be trusted to have
reached anyone.

Everything downstream of that fix is worse, not better. Five independent lenses, each reading
live repo/GitHub/Linear state fresh rather than trusting this memo's framing, converge on the
same conclusion from different angles: **the org now has a fully unstuck pipeline and is using it
to ship the wrong things.** PR #373 — the fix for an admitted ADR-0009 governance violation, which
flips a disarmed-but-nominally-armed `Auto-merge` kill switch to `off` — has gone from 4 days
open at the last review to **11 days**, with nine automated "still open, still no reply" bot
comments on the thread and zero founder replies to any of them (CFO lens, verified via the PR's
full comment history). In the same 7-day window that PR sat open, **44 commits landed on `main`,
24 of them (54%) design-system Card/Eyebrow/Field primitive callsite migrations** — the exact
category of work the board voted to freeze on 2026-07-26 and reaffirmed freezing on 2026-08-02.
This is not a queue-depth problem anymore (only two PRs are open right now, both correctly
held for founder review); it is the fleet choosing legible, self-contained polish work over the
harder, more consequential items sitting in front of it, for a second consecutive week, after
being told twice not to.

The clearest single illustration is N-386, the fallback award-data-source prototype. Every lens
that checked it (growth, CFO, travel-industry, product-skeptic — four of five) independently
confirmed it is still `Backlog`, `startedAt: null`, **zero code, 21 days old**, and has now been
named the board's own "cheapest available de-risking move" in **five consecutive weekly memos**.
It has never been founder-blocked. Nothing in this week's 44 merged commits touches it. The
growth-operator lens put it most sharply: "That is not a founder-blocked story — that is the
fleet choosing legible, low-risk, review-friendly work over a real product-risk build every
single day it had a choice."

The travel-industry lens delivered this week's one genuinely new, well-verified finding: the
observed-cpp valuation-sync pipeline — last week's "contested point" — is **definitively live**,
confirmed by a direct `curl` against production (`https://hop.flights/api/stats` → `200
{"verifiedPrograms":14,"totalPrograms":34,...}`) and two Linear health-sentinel tickets
auto-filed *this run* (N-398, N-399, dated 2026-08-08 and 2026-08-09). The board's own §4
question from last week is answered: yes, it's live. But the follow-through the board and
strategy desk both explicitly asked for — ship a public page off it — never happened. Two
duplicate Linear tickets for exactly that (N-395 and N-396, filed 17 seconds apart on 2026-08-02,
itself a minor agent-hygiene defect) have sat `Backlog`, zero code, for the full 7 days since the
merge-pipeline blocker that was supposedly holding them cleared. And the same lens raises a
harder, unresolved question underneath the "it's live" answer: with ~14 visitors/week and 33
straight days of zero confirmed-`Regular` conversions, the sample volume behind those trust-gated
overrides is plausibly dominated by hop's own scheduled crons and MCP traffic re-querying a fixed
route list, not organic market demand — which would make this a monitoring layer over a rented
feed, not the proprietary moat the framing implies. Nobody has checked the sample composition to
settle this either way; it needs D1/Vercel access no session in the fleet has.

Underneath both is the same trio every board memo has now named for a fifth-plus consecutive
week: N-320 (seats.aero commercial terms, owner-only) is **34 days silent** (was 29 last week);
`HOP_ENABLE_BILLING` is still on against that same unlicensed, now openly-competing feed; and the
2026-07-05 northstar's **2026-08-05 $10k-MRR target has now definitively expired at $0 realized
revenue** — confirmed independently by the 2026-08-05 and 2026-08-07 funnel-log entries — while
`docs/agent-playbook.md`'s "## The goal" section still states it, today, unqualified, as though
the date hasn't passed. Three consecutive board memos (7/19, 7/26, 8/02) asked for an explicit
reset or reaffirmation of that target and got no logged answer; it is now simply false in the
file that reads it to every new session.

Two new findings this week worth naming plainly, both surfaced independently by different lenses.
First, the subscription-economics lens found a *second*, previously-unflagged self-contradiction
sitting next to the already-known R0.2 one: `docs/finance/budget.md`'s 2026-07-28 entry states
the $99/yr pricing raise "cannot even start its clock while `HOP_ENABLE_BILLING` stays **off**,"
while `docs/ops-runbook.md` and every board memo since 2026-07-19 state billing is **on**. Two
load-bearing docs now give opposite answers to "is billing on" — on top of the still-unresolved
"has R0.2 (one real purchase) ever passed" contradiction inside `ops-runbook.md` itself, flagged
as agents-can-execute a week ago and still untouched. Second, the CFO lens found the finance desk
has gone dark: its last ledger entry is run 8, dated 2026-08-04, five days before this review,
and `lib/unit-economics.ts`'s `llmCostUsd` remains hardcoded to a `null` fallback despite Linear
N-312 (the ticket for wiring it up) being marked **Done** — another instance of the exact
done-claim-without-evidence pattern this review exists to catch, this time in the org's own cost
accounting rather than its process narrative.

## 2. Follow-through on last week's amendments (2026-08-02 memo §7, now merged and verifiable)

| # | Amendment | Status this run |
|---|---|---|
| 1 | Resolve PR #373 | **Not done — worse.** 4 days → **11 days**. `Auto-merge: on` unchanged in `docs/autonomy-runbook.md`; 9 automated nag comments, zero founder replies. |
| 2 | Mechanical "pipeline is actually clear" check | **Not built.** Grepped `docs/`, `.github/workflows/`, `scripts/` — exists only as a recommendation in two more memos, never as code. |
| 3 | Reply to seats.aero / decide billing | **Not done — worse.** 29 days → **34 days** silent. `HOP_ENABLE_BILLING` still on. |
| 4 | Reset/reaffirm 2026-08-05 MRR target | **Not done — now false, not just stale.** The date has passed (target expired at $0); `docs/agent-playbook.md:34` still states it as live with no correction. |
| 5 | Reconcile ops-runbook.md R0.2 contradiction | **Not done — and now broader.** Same two lines unchanged; a second contradiction found (`budget.md` vs `ops-runbook.md` on billing on/off). |
| 6 | Build N-386 | **Not done.** Zero code, now 21 days, 5th consecutive memo naming it the cheapest available move. |
| 7 | Verify valuation-sync live; ship public page if so | **Half-resolved.** "Is it live" is now directly confirmed (`/api/stats` curl, live health-sentinel tickets). Shipping the page (N-395/N-396) is still zero code, 7 days after its stated blocker cleared. |
| 8 | Backfill outreach.md approval-log | **Done.** Finance run 8 (2026-08-04) backfilled it per the board's own ask. |
| 9 | Freeze design-system PR creation until #2 passes | **Violated, worse than last week.** 24 of 44 merged commits (54%) since 08-02 were design-system migrations, continuing through 08-06 — a second consecutive week of this exact violation. |
| 10 | Post the 3 ready-to-paste drafts | **Not done — worse.** 27 days → **32 days**, 12th consecutive flag. |
| 11 | Grant finance desk DB/Stripe access or pause it | **Not done — worse.** Ledger's last entry is now 5 days stale (run 8, 08-04); desk has gone dark, not just under-resourced. |
| 12 | Drop funnel-log cadence 3x/week → weekly | **Not confirmed done.** Entries still landed 08-05 and 08-07, 2 days apart — more frequent than weekly. |
| 13 | Move N-387 out of Backlog or decide | **Not checked this run** — no lens examined it directly; carrying forward unconfirmed. |
| 14 | Fold `llmCostUsd` into B3 panel | **Not done — and mis-marked.** Still hardcoded `null`; Linear N-312 (this exact fix) is marked **Done**, which is false. |
| 15 | Fix board/strategy cron ordering | **Not done**, 6th+ consecutive week, not independently re-checked this run. |

**Net: 1 of 15 clearly done (#8), 1 half-resolved (#7 — the underlying question answered, the
action still undone), 13 unchanged or worse.** This is a worse ratio than last week's "2 of 15
done, 1 done-then-undone" — and unlike last week, the pipeline itself is no longer the excuse.
Every item still open is either founder-gated and genuinely waiting, or agent-executable and
simply not picked up in favor of design-system polish.

## 3. Consensus risks (2+ lenses independently agree)

- **N-320 (seats.aero) is 34 days silent, `HOP_ENABLE_BILLING` remains on against that unlicensed,
  competing feed, for a 6th consecutive week.** All 5 lenses independently confirmed via live
  Linear state (`Backlog`, `startedAt: null`, unchanged since 2026-07-28) and `docs/ops-runbook.md`.
  Subscription-economics adds the sharpest framing: the plan's own §3.1 calls this gate "hard, all
  four," and it has been violated in the open, by the founder's own hand, for over a month.
- **PR #373 (the governance kill-switch fix) is unresolved at 11 days, and `Auto-merge` has never
  once been flipped off in the file's history despite an admitted violation.** CFO, product-skeptic,
  travel-industry, and subscription-economics all independently verified the PR's live GitHub
  status and the runbook's current text. CFO's specific addition: 9 automated bot check-in
  comments on the thread, zero founder replies to any — "diligence theater," not progress.
- **N-386, the one item every lens agrees is genuinely agent-buildable and founder-independent,
  is still zero code after 21 days and 5 consecutive memos naming it the cheapest de-risking move
  on the board.** Growth, CFO, travel-industry, and product-skeptic each independently confirmed
  its Linear state and its complete absence from this week's 44 merged commits.
- **Design-system PR creation continued through a second consecutive week directly against an
  explicit board-voted freeze** — 54% of everything merged since 08-02. Growth, CFO,
  travel-industry, and product-skeptic each independently counted this from `git log`, converging
  on the same figure from different queries.
- **PR #409 (the MCP registry listing) — the cheapest, lowest-friction founder ask currently on
  the board — has sat unreviewed for 2 days.** Growth, CFO, travel-industry, and product-skeptic
  all flag it: no external account, no legal judgment, a single merge click, self-activating.
  Growth-operator's framing: if a 5-minute, zero-risk review sits for days, that's evidence about
  where the real bottleneck is.
- **The 2026-08-05 $10k MRR target has expired at $0 and `docs/agent-playbook.md` still states it,
  unqualified, as the live goal.** Subscription-economics, product-skeptic, and CFO converge: this
  is no longer "at risk," it is a false statement sitting in the file every new session reads
  first, four days after its own deadline passed with zero correction.
- **`docs/ops-runbook.md`'s R0.2 self-contradiction is still unresolved, one week after being
  tagged agents-can-execute** — and subscription-economics found it now sits next to a second,
  broader contradiction (`docs/finance/budget.md` asserting billing is off, `ops-runbook.md`
  asserting it's on). Product-skeptic and CFO both independently confirmed the original
  contradiction's exact two lines are byte-for-byte unchanged from last week.

## 4. Contested points (no false consensus)

- **Is the observed-cpp pipeline a real proprietary moat, or a monitoring layer over hop's own
  automated traffic hitting a rented feed?** The travel-industry lens is the only one to examine
  this directly this week, and its finding is sharper than "inert vs. live" — the pipeline is
  confirmed live (production `curl`, real auto-filed health-sentinel tickets), but with ~14
  visitors/week and 33 days of zero confirmed-`Regular` conversions, the sample volume behind the
  trust-gated overrides (delta 1,278 samples, virgin-atlantic 296, etc.) is plausibly dominated by
  hop's own crons (`/api/cron/standing-orders`, `/api/cron/sweet-spot-candidates`) and MCP calls,
  not organic market demand. If true, this is cheap for any competitor with the same seats.aero
  access to replicate, and it evaporates entirely if that access is revoked. No other lens checked
  this angle; genuinely unresolved without D1/Vercel dashboard access nobody in the fleet has.
- **Should the weekly board + strategy dual cadence itself be killed or radically compressed?**
  The CFO and product-skeptic lenses independently reached this same conclusion from different
  angles — CFO: "compute spent generating agreement with itself, not new information"; product-
  skeptic: "two desks producing ~35KB of adversarial prose a week... converging on identical
  findings anyway." Growth and subscription-economics didn't weigh in on cadence specifically, and
  travel-industry's own findings this week (the live-pipeline confirmation, the N-395/N-396 gap)
  argue the opposite — that fresh, independent verification each week is still catching things a
  lighter-touch check would miss. Flagging as genuinely contested rather than resolving it here,
  since it is a decision about how the founder gets informed, not a pure execution question.
- **Is "founder-blocked" being used as honest description or as fleet cover?** The growth-operator
  lens ran this as an explicit adversarial self-check and concluded "both, and the fleet's share is
  understated in its own logs" — the drafts and N-320 are genuinely founder-only, but N-386 has
  been named non-founder-blocked in every memo since 7/19 and still has zero code, while the fleet
  spent the same window on 24 design-system commits. No other lens ran this specific check, so
  presenting it as one lens's finding rather than board consensus, though nothing this week
  contradicts it.

## 5. Kill list (board would vote for)

1. **Freeze new `feat(design-system): *` PR creation with a mechanical, enforced gate** — not
   another memo vote. This exact freeze has now been voted twice (07-26, 08-02) and violated
   twice; a third vote without an enforcement mechanism (e.g., a `docs/autonomy-runbook.md` "never
   pick" list entry, or a required "cite the last real merge SHA" line in the PR body per
   product-skeptic's suggestion) is not a real kill, it's a ritual.
2. **Stop stating the 2026-08-05 MRR target as live in `docs/agent-playbook.md`.** It is now
   simply false, not merely stale — correct it whether or not the founder has chosen a new number.
3. **Stop the automated daily "still open, still no reply" bot check-in comments on stalled
   owner-gated PRs (#373 specifically — 9 comments, zero informational content after the second
   one).** This is agent-compute performing diligence theater on a thread that moves only when a
   human looks at GitHub.
4. **Suspend the weekly finance-desk ledger run** until DB/Stripe read access exists or MRR status
   changes materially — 8 runs (now 5 days stale on top of that) have produced the identical
   "$0/unknown, no DB access" finding; a 9th adds no new information.
5. **Carried, unchanged**: no further `/mcp` page polish beyond what's needed to land PR #409; no
   further `/guides`/sweet-spot content until N-387 exists (freeze holding in practice).

## 6. Double-downs

- **The `$virt_traffic_type` automation-detection discipline in the funnel log** — three lenses
  (growth, subscription-economics, product-skeptic) independently reconfirmed it caught and
  downgraded a *third* distinct false-positive `signed_up` spike this week (2026-08-05, 100%
  `Automation`). This remains the single most rigorous, load-bearing piece of analysis in the
  entire weekly-desk output; keep it non-negotiable.
- **`lib/pricing.ts`'s single-source-of-truth pattern and the `isBillingEnabled()`/
  `isCheckoutEnabled()` double-lock gating mechanism** — subscription-economics confirmed both
  clean again this run, no drift, no hand-typed prices found anywhere. The *code* is not the
  problem; the *policy decision* sitting on top of it (whether to flip it) is what's stuck.
- **PR #409's self-restraint** — product-skeptic and travel-industry both flag it as the clearest
  evidence the fleet learned something concrete from the #373 incident: it correctly declined to
  self-merge a `.github/workflows/**` change and cited the exact ADR-0009 line, the opposite
  failure mode from the one that produced #373 in the first place.
- **N-370's Linear state discipline** — confirmed directly via state history: still "In Progress,"
  never falsely re-marked "Done" since 2026-07-19, holding cleanly three-plus weeks running.
- **`computeMrr()`'s real, ledger-derived MRR math** (`lib/unit-economics.ts`) — subscription-
  economics confirmed it reads actual `hop_subscriptions` rows against real Stripe price IDs; the
  repeated "$0/unknown" is an *access* gap in these sessions, not a missing-code gap. One session
  with real DB/Stripe read access would answer "has anyone ever paid us" mechanically, in minutes.

## 7. Ranked amendment list

1. Resolve PR #373 this week — merge (restoring `Auto-merge: off` and reverting the ADR-0009
   violation) or close with a recorded decision. 11 days open, worse than last week's 4.
   **[needs-founder]**.
2. Merge or close PR #409 (MCP registry listing) — the cheapest, lowest-risk founder ask on the
   entire board right now: no external account, no legal judgment, one click, self-activates.
   **[needs-founder]**.
3. Reply to seats.aero (N-320) or explicitly flip `HOP_ENABLE_BILLING` off — 34 days silent, the
   oldest and hardest blocker on the board, now gating billing legitimacy, the (already-failed)
   MRR target, and the raise-gate simultaneously. **[needs-founder]**.
4. Correct `docs/agent-playbook.md`'s "## The goal" section — the 2026-08-05 target has passed
   and failed at $0; strike or annotate it rather than leaving it stated as the live goal.
   **[agents-can-execute]**.
5. Reconcile `docs/ops-runbook.md`'s R0.2 self-contradiction **and** the newly found
   `docs/finance/budget.md` vs. `ops-runbook.md` billing-on/off contradiction, in one PR, one
   current answer per question. **[agents-can-execute]** for internal doc consistency;
   **[needs-founder]** to supply the actual ground truth for both.
6. Build N-386 (fallback award-data-source prototype) — zero code, 21 days, named the board's
   cheapest available de-risking move in 5 consecutive memos, still entirely non-founder-blocked.
   **[agents-can-execute]**.
7. Ship the observed-cpp public page — dedupe N-395/N-396 first, then build. The contested
   question is resolved (production `curl` confirms 14/34 verified programs, live health-sentinel
   tickets firing), the stated blocker (merge pipeline) cleared 7 days ago, nothing stands between
   decided and shipped. **[agents-can-execute]**.
8. Before or alongside #7, fix the "N live bookings" copy claim in
   `components/landing/LiveValuationShelf.tsx` — it measures search-time quotes from crons/MCP
   traffic, not completed bookings; correct the copy now, before a public-facing version scales
   the overstatement. **[agents-can-execute]** for the copy fix; **[needs-founder]** for D1/Vercel
   access to check the underlying sample composition (cron/MCP vs. real user search) per §4's
   contested point.
9. Build a mechanical, enforced freeze on new design-system PR creation — an autonomy-runbook
   "never pick" entry or a required last-real-merge-SHA citation in the PR body — since two plain
   memo votes (07-26, 08-02) have both been violated without one. **[agents-can-execute]**.
10. Post the 3 ready-to-paste community drafts — 32 days, 12th consecutive flag, zero agent
    substitute possible. **[needs-founder]**.
11. Decide whether to collapse or compress the weekly board + strategy dual cadence — two
    independent lenses (CFO, product-skeptic) recommend it this week; this changes how the founder
    gets informed, so it's the founder's call, not the board's to self-cancel.
    **[needs-founder]**.
12. Suspend weekly finance-desk ledger runs until DB/Stripe read access is granted, or grant the
    access — 8 runs of "$0/unknown," desk itself now 5 days dark on top of that.
    **[needs-founder]**.
13. Fix `lib/unit-economics.ts`'s `llmCostUsd` — wire it to something real, or stop letting Linear
    N-312 read "Done" and the B3 panel imply a tracked number where there's a hardcoded `null`.
    **[agents-can-execute]**.
14. Reduce or remove the automated daily bot check-in comment pattern on stalled owner-gated PRs
    — 9 comments on #373 with zero informational value after the second one.
    **[agents-can-execute]**.
15. Fix the board/strategy cron ordering — 6th+ consecutive week named, still cheap, still
    unfixed. **[agents-can-execute]**.

## 8. Questions for the founder (verbatim, one per lens)

1. "Given that R0.2 ('one real purchase') and the current `HOP_ENABLE_BILLING` state are recorded
   two contradictory ways across `docs/ops-runbook.md` and `docs/finance/budget.md`, and no agent
   session has DB/Stripe read access to check the ground truth directly — can you either (a) state
   plainly, right now, whether billing is currently on or off and whether the one 'real purchase'
   was you testing the rail or an actual paying stranger, or (b) grant one session read-only
   Stripe/DB access so this stops being re-asked every week?"
2. "Do you have Vercel/Cloudflare D1 dashboard access to pull the actual `hop_valuation_overrides`
   sample composition (cron/MCP vs. real end-user search) for even one program — because if the
   'first-party observed' data behind the differentiation story is mostly hop's own automated
   traffic re-querying a rented feed, that changes whether this is a moat worth doubling down on
   or a monitoring feature worth being honest about, and no amount of code-reading from an agent
   session can settle that with certainty."
3. "Is $0 MRR, 34 days past your own Wk1 payment-gate deadline and 5 days past your own 30-day
   northstar's failure, still an experiment you're funding, or is this fleet now running on
   inertia you haven't consciously re-approved — and if it's the former, what dollar or day figure
   would actually make you say stop?"
4. "PR #409 (the MCP registry listing) has been open for review for 2 days, requires no external
   account and no legal judgment — just a merge click — and self-activates the moment it lands:
   will you merge or close it this week, and if a 5-minute, zero-risk review sits for days, should
   we conclude your bottleneck really is time, not attention, before we keep excusing 33 days of
   zero growth as 'founder-blocked'?"
5. "Two of the eleven items your own board has asked you to decide (PR #373, N-320) are now 11 and
   36 days old respectively, and the doc your agents read as 'the goal' every session still tells
   them to chase a $10k-by-08-05 target that failed at $0 four days ago with no correction in the
   file — do you want the fleet to start applying safe, reversible defaults on your behalf when a
   `[needs-founder]` item passes some fixed age (e.g., auto-flip `Auto-merge: off` at 7 days
   unresolved, auto-strike an expired revenue target at its deadline), or is silence on these
   specific items an intentional signal that you'd rather the fleet slow down and wait than act
   without you?"

*(Minor note: the lenses' day-counts for N-320/seats.aero and PR #373 vary slightly — 33/34/36
days and 4/11 days respectively — reflecting each agent's own run timestamp within this review
window, not a factual disagreement. This memo's body uses the figures independently recomputed
from the sent-date/created-at fields directly: 34 days for seats.aero, 11 days for PR #373.)*

Two threads run through all five, asked independently with no shared context: **the fleet now has
a genuinely unstuck pipeline and is spending it on the wrong queue — every founder-blocked item
this review names has a matching agent-executable item sitting right next to it, unbuilt, for no
reason but prioritization — and the org is 5+ days past its own declared revenue-experiment
failure point with no explicit founder decision yet on what that means.**

---

## Process note on this review itself

This run confirms the institutional-memory pipeline that broke for two consecutive weeks is
fixed: both the 2026-08-02 board memo (PR #383) and strategy note (PR #384) are merged, and this
memo synthesizes from that merged baseline plus fresh, independent verification by all 5 lenses
(live GitHub PR/comment state, a live Linear pull, a live production `curl`, direct file reads —
not from any prior memo's prose). Two lenses this week (CFO, product-skeptic) independently
recommended examining whether this very review cadence has become the kind of legible, low-risk
work the fleet defaults to instead of harder execution — flagged in §4 as contested rather than
resolved, since it's a decision about how the founder wants to be informed, not one this process
should make for itself.
