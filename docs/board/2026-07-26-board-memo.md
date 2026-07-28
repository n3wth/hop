# hop — Board Review Memo (2026-07-26)

## 1. State of the company

A new, structural failure this week sits on top of the two already-open founder blockers, and it
reframes how to read everything else: **the merge pipeline itself is stuck.** The last commit to
land on `main` was PR #317, merged 2026-07-23T10:48 UTC. Fifteen PRs were opened in the range since
(#318–#332); two (#322, #326) were closed unmerged, leaving 13 currently open — every one of those
13 is stuck. Multiple lenses independently pulled the same evidence: PR #318 (a new
AI Customer Support Agent surface) has shown `Vercel: pending` since 2026-07-26T00:43 UTC with zero
update; PR #324 (`/pricing`'s FAQ/JSON-LD — the mechanical half of last week's #2 amendment) has
been `pending` since 2026-07-24T15:11 UTC, 45+ hours; PR #325 (the growth desk's own 2026-07-24
funnel-log entry) is stuck the same way, which means **`docs/marketing/funnel-log.md` on `main` is
now stale** — the real latest read only exists inside an unmerged PR. `main`'s branch protection
requires the `Vercel` check to pass before merge, and that check is not resolving — pending, not
failing, which means nothing is actively rejecting these PRs, they are simply accumulating. This
is a second, distinct CI failure mode from the already-known GitHub Actions billing outage
(`docs/ops-runbook.md` §CI, still broken, still `workflow_dispatch`-only, now 17+ days) — GitHub
Actions being down was a known, worked-around gap; a stuck *required* status check is new and
currently blocks 100% of the merge pipeline, not a fallback path around it.

This matters beyond throughput. It changes how last week's 1-of-13 follow-through number should be
read. Last week's board treated the org's near-total non-execution as inertia against two
founder-only blockers. This week's evidence shows at least one agent-executable amendment — #2,
finishing `/pricing`'s FAQ/JSON-LD — actually *was* attempted (PR #324, real diff, real content)
and simply cannot land. The fleet did the work; the pipe ate it. That reframes some — not all — of
the "unchanged" items below from "not attempted" to "attempted, blocked by new infrastructure,"
which is a materially different diagnosis and a materially different fix.

Meanwhile, the two founder-only blockers from every prior memo are both worse by the calendar, not
better: the seats.aero commercial-terms email has now gone unanswered **20 days** (`docs/finance/
outreach.md`, `status: sent`, `sent-date: 2026-07-06`, no reply logged, ever) while
`HOP_ENABLE_BILLING` stays on per `docs/ops-runbook.md`; the finance desk has now gone **12 days**
silent (last `docs/finance/ledger.md` entry 2026-07-14), worse than the 5 days flagged last week;
and the three ready-to-paste community drafts are now roughly **20 days** stale for the oldest two.
The 2026-08-05 $10k MRR northstar is **10 days away** with its single gating dependency (N-320)
unmoved for 20 of those days — this review is not aware of any explicit decision yet to keep or
reset that target.

One genuinely new and material finding, not previously flagged in any board or strategy memo:
commit `309de77` (merged this week, PR #315) removed all public Claude/ChatGPT branding from
`/mcp`, `/account`, and `/support`, with the commit message stating plainly: **"Oliver can't
publicly name/promote non-Gemini LLM products while at Google."** This is a real, structural
constraint on hop's MCP/agent-distribution bet — the same bet the business plan and two prior
strategy notes lean on as hop's most defensible remaining edge against point.me and Award Travel
Finder — and it has not been named or reasoned about in any prior board or strategy document. It
does not by itself invalidate the MCP bet, but it changes the shape of it (product must win on
protocol-generic distribution, not on being named by a specific popular AI assistant), and the
board has not yet had a chance to weigh in on that shift. Flagged below as a new contested point
and a founder question.

One clean win, and only one, closed cleanly and confirms the org still executes when nothing is in
its way: `docs/marketing/funnel-log.md`'s 2026-07-22 entry (merged, on `main`) closed last week's
amendment #9 by adding a standing `$virt_traffic_type` check after correctly catching and
downgrading a false-positive "first signup" that traced to `Automation`-classified traffic, not a
real conversion — genuine self-correction, the same discipline the 2026-07-19 memo called out as
worth reinforcing.

**Process note on this review itself**: Linear was not reachable this session (the MCP connector
requires interactive OAuth, unavailable to a scheduled/headless run). This memo could not verify
N-319/N-320/N-370/N-386/N-387's live Linear status, and step 5 of this review's own instructions
(posting the memo summary to the standing Linear thread) could not be completed. All findings below
are grounded in repo/docs/GitHub evidence only, per each lens's explicit instruction not to
fabricate Linear state. This is itself worth fixing — see the ranked amendments.

## 2. Follow-through on last week's amendments (2026-07-19 memo §7)

| # | Amendment | Status this run |
|---|---|---|
| 1 | Gate `/pricing`'s `metadata` export behind `isBillingEnabled()` | **Done** — PR #304, merged 2026-07-20, confirmed live in `app/pricing/page.tsx`. Closed last week; carried here for completeness. |
| 2 | Resolve N-319 fully (finish or revert/freeze) | **Attempted, blocked — new finding.** PR #324 adds the FAQ/JSON-LD content per spec, but has been stuck `pending` on the Vercel check 45+ hours and cannot merge. Underlying billing-on/off call still `[needs-founder]`. |
| 3 | Start the fallback award-data-source prototype | **Not done.** Confirmed zero lines of code touching award availability besides `lib/seatsaero.ts`, now a 3rd–4th consecutive week flagged. |
| 4 | Content staleness/"verified as of" guard before further content | **Not built, but not violated either.** `git log --since=2026-07-20 -- app/guides app/sweet-spots` is empty — the freeze held clean a second straight week. Still no mechanical guard exists. |
| 5 | Reopen Linear N-370 (perpetual thread) | **Not verified this run** — Linear unreachable this session (see §1 process note). |
| 6 | Fix board/strategy cron ordering | **Not done**, 3rd+ week running. `docs/team/routines.md` still shows board `0 13 * * 0`, strategy `0 15 * * 0` — this week's board review again fires before the strategy desk, which has produced no file newer than 2026-07-19 as of this writing. |
| 7 | Billing-gate-status line in `docs/ops-runbook.md` §3.1 cross-ref | **Not verified this run** either way. |
| 8 | Fold `llmCostUsd` into the B3 unit-economics panel | **Not done** — confirmed still hardcoded `null` at `lib/unit-economics.ts:32,120`. |
| 9 | Add referrer/source-split to the funnel log before drawing conclusions | **Done** — closed in the 2026-07-22 funnel-log entry (merged, on `main`), which added a standing `$virt_traffic_type` check and used it to correctly downgrade a false-positive signup. First new close this week besides #1/#2. |
| 10 | Stop tracking the $99/yr raise-gate as "in progress" | **Not verified this run.** |
| 11 | Reply to seats.aero / decide on billing | **Not done — worse.** 20 days unanswered (was 13 last week), `HOP_ENABLE_BILLING` still on. |
| 12 | Post the 3 ready-to-paste drafts | **Not done — worse.** ~20 days for the oldest two (was 13–14 last week). |
| 13 | Fix GitHub Actions billing | **Not done.** `docs/ops-runbook.md` §CI unchanged, now 17+ days broken. Compounded this week by the separate, more acute Vercel-check stall (§1). |
| 14 | Grant the finance desk DB/Stripe read access, or pause it | **Not done — worse.** 12 days silent (was 5 last week); no 2026-07-21 entry exists at all, meaning even the weekly cadence itself lapsed, not just the access blocker. |
| 15 | Decide explicitly whether to reset the Aug-5 MRR target | **Not done.** 10 days remain; N-320 unmoved 20 of the last 22 days. |

**Net: 2 of 15 done (was 1 of 13 last week — items 1 and 9 both closed cleanly), 1 attempted-but-
blocked by a newly discovered infrastructure fault (item 2), 2 unverifiable this run (Linear
unreachable), the remaining 9 unchanged or measurably worse by the calendar.** The genuine
improvement (2 clean closes instead of 1, plus one real attempt on a third) is real; it is also now
entangled with a new blocker — a stuck required CI check — that no prior review anticipated and
that could fully explain why "attempted" work isn't reliably becoming "done" work even when the
fleet does the right thing.

## 3. Consensus risks (2+ lenses independently agree)

- **The merge pipeline is stuck fleet-wide, not per-PR.** All five lenses independently pulled the
  same evidence via GitHub's PR-status API: PRs #318, #324, #325, #331, #332 all show `Vercel:
  pending` frozen at creation time for 24–45+ hours with zero status update. `main`'s branch
  protection requires this check. Nothing has merged since PR #317 (2026-07-23T10:48 UTC) — three
  days and 13 PRs of pure accumulation. The CFO lens flagged this as a second, distinct failure
  mode from the known GitHub Actions billing outage; the product-skeptic lens flagged that it means
  none of this week's "done"-claiming PR bodies (including a whole new AI support-agent surface)
  are currently backed by a merged, verified commit.
- **HOP_ENABLE_BILLING is live against an unlicensed seats.aero feed for a 4th consecutive week,
  now 20 days past the outreach email with zero logged reply.** Subscription-economics and CFO
  lenses both independently confirmed via `docs/ops-runbook.md` and `docs/finance/outreach.md` —
  this is no longer a new risk, it is a standing, uncorrected exposure that has aged from 13 to 20
  days across two consecutive board reviews with no owner action either way.
- **`docs/finance/outreach.md` still has no approval-log entry** for the two founder-attributed
  emails sent 2026-07-06, despite being escalated "🚨 ESCALATED" as needs-founder in the
  2026-07-19 memo. Subscription-economics and CFO lenses both flag this as unresolved, now 20 days
  open.
- **The fallback award-data-source prototype remains zero lines of code**, now a 3rd–4th
  consecutive week flagged (travel-industry, subscription-economics via the follow-through table)
  — still the cheapest available de-risking on the board and still untouched.
- **The finance desk's silence has gotten worse, not better, since being flagged.** CFO lens found
  it's now 12 days silent (was 5 at the 2026-07-19 review) and that the weekly cadence itself
  lapsed — no 2026-07-21 entry exists at all, a new and sharper version of last week's finding.
- **Community distribution remains fully founder-blocked with zero agent substitute, now ~20 days
  stale for the oldest drafts.** Growth and CFO lenses both independently confirm; growth lens adds
  that Product Hunt/X drafts (named in `docs/marketing/README.md` as intended channels) have never
  actually been written, unlike HN/Reddit/MCP-directories — a small, real, still-open agent task
  distinct from the founder-blocked posting itself.

## 4. Contested points (no false consensus)

- **Should the fleet keep shipping new PRs into a queue that cannot currently merge anything, or
  pause?** The CFO lens argues for a broad freeze: "Freeze new PR generation from
  growth/design-system/self-improve desks until the merge pipe is provably unstuck." The growth and
  product-skeptic lenses take a narrower view — get the specific stuck, ready-to-ship PRs (#324,
  #325, #318) unblocked first, and only hold back PRs whose *own* dependency is broken (product-
  skeptic: don't merge #320/#327, the new GitHub Actions workflows, until Actions billing is fixed
  — a targeted hold, not a general one). No lens argued the pipeline problem should be ignored; the
  disagreement is blanket freeze vs. targeted triage.
- **Is the observed-cpp telemetry pipeline (`lib/valuations-live.ts`) actually a live
  differentiator, or still vaporware?** The travel-industry lens found `HOP_ENABLE_VALUATION_SYNC`
  and its companion env vars are unset, and `cloudflare/valuations-worker/` has had zero commits
  since before the 2026-07-19 review — meaning the pipeline the last two strategy notes cited as
  hop's structural edge over point.me's static "Good/Great" labels is currently inert, not live.
  This directly contradicts the framing in `docs/strategy/2026-07-19-weekly-strategy.md`, which
  treated it as an active, accumulating edge. No other lens independently checked this claim this
  run — flagging as contested-by-new-evidence rather than confirmed consensus, but it is
  concerning enough that it should not wait a week to be resolved either way.
- **Does the Google/Gemini public-promotion constraint (commit `309de77`, §1) change whether MCP
  distribution is still the right bet?** Raised by the travel-industry lens only this run — a
  genuinely new structural fact, not previously reasoned about by any prior board or strategy
  memo. It does not by itself kill the MCP thesis (protocol-generic distribution still works
  without naming a specific AI assistant), but it is a real handicap against Award Travel Finder,
  which faces no such constraint. Flagging for explicit board discussion next week rather than
  asserting a verdict on one lens's read.

## 5. Kill list (board would vote for)

1. **Hold new feature-PR creation from the design-system and self-improve desks specifically**
   until the merge pipeline is confirmed unstuck — not a blanket fleet freeze (docs-only entries
   like funnel-log updates and small, ready fixes like #331 should still ship and queue), but no
   more net-new surface area added to a backlog that already can't clear. Four design-system PRs
   (#319, #323, #329, #330) and three self-improve/audit PRs (#320, #327, #328) are open
   concurrently against a dead queue; two of the self-improve PRs (#320, #327) reference GitHub
   Actions secrets/workflows that can't fire until Actions billing is separately fixed anyway.
2. **Do not merge #320 or #327 (new GitHub Actions workflows) until GitHub Actions billing is
   confirmed fixed** — they would land dead-on-arrival otherwise, per the product-skeptic lens.
3. **Stop letting `docs/finance/outreach.md` send founder-attributed external emails without a
   logged approval-log entry** — this was escalated a week ago and is still open; either backfill
   an approval record (if Oliver did approve) or treat future sends as blocked until the format
   matches `docs/finance/budget.md`'s.
4. **Stop treating the seats.aero silence as passively "sent, pending."** 20 days is past the point
   where "wait for a reply" is a defensible default — carried forward from last week, sharper now.
5. Carried from last week, unchanged: no further `/mcp` page polish until at least one MCP-
   directory submission actually lands; no further `/guides`/`sweet-spot`/methodology content until
   a real staleness guard exists (freeze is holding, so this is precautionary, not a violation).

## 6. Double-downs

- **The plan-to-PR discipline on PR #318 (AI Support Agent)** — the product-skeptic lens checked
  it against `docs/plans/2026-07-02-ai-support-agent.md` and found the file list matches almost
  1:1, it's flag-gated (`HOP_ENABLE_SUPPORT_AGENT`), and it touches zero migrations. This is good
  scope discipline, just badly timed — it's currently stuck behind the same stuck check as
  everything else, not a scope-creep problem in its own right.
- **`lib/pricing.ts`'s single-source-of-truth pattern and the `isBillingEnabled()` flag+body/head
  parity pattern** — subscription-economics lens: no PR in the current 13 attempts to change the
  price or the raise-gate conditions; the pattern PR #304 established is holding.
- **The content-pipeline freeze** — now clean two straight weeks (`git log` confirms zero
  `app/guides`/`app/sweet-spots` commits since 2026-07-20), the first time either half of the
  freeze has held this cleanly across consecutive reviews.
- **The funnel-log's self-correction discipline** — the 2026-07-22 entry that caught and downgraded
  a false-positive "first signup" by adding the standing `$virt_traffic_type` check, closing board
  amendment #9 in the process. Real, load-bearing rigor, worth continuing to reinforce as the house
  standard.

## 7. Ranked amendment list

1. **Diagnose and unstick the frozen Vercel required-status-check** blocking all 13 open PRs — the
   single highest-leverage item this week; nothing else can land until this clears. Investigating
   the check state and re-triggering it is **[agents-can-execute]**; if it turns out to be a
   Vercel/GitHub App integration fault (not something a repo-scoped session can fix), escalating to
   Vercel support or the dashboard is **[needs-founder]**.
2. Once unstuck, land the small, ready, already-reviewed PRs first — #331 (a real prerender-crash
   fix), #324 (`/pricing` FAQ/JSON-LD, closes amendment #2), #325 (growth's stale funnel-log entry)
   — before any new feature PR merges. **[agents-can-execute]**.
3. Hold new design-system and self-improve PR creation per kill-list #1 until the pipeline is
   confirmed clear, then resume. **[agents-can-execute]**.
4. Start the fallback award-data-source prototype — 3rd–4th week running at zero code, still the
   cheapest available de-risking on the board. **[agents-can-execute]**.
5. Verify whether `HOP_ENABLE_VALUATION_SYNC` and the Cloudflare worker are actually live — if the
   observed-cpp differentiator is inert (per §4's contested finding), either flip it on this week
   or stop citing it as an active edge in strategy material until it is. **[agents-can-execute]**
   to verify and flip the flag/deploy the worker if config-only; **[needs-founder]** if it requires
   a decision about the differentiator claim itself.
6. Reply to seats.aero (N-320) or explicitly decide to flip `HOP_ENABLE_BILLING` off — 20 days
   unanswered, the oldest and hardest blocker on the board. **[needs-founder]**.
7. Post the 3 ready-to-paste community drafts — ~20 days for the oldest two, zero agent substitute.
   **[needs-founder]**.
8. Grant the finance desk read-only DB/Stripe access, or explicitly pause it — 12 days silent, a
   lapsed weekly cadence, not just an unanswered question. **[needs-founder]**.
9. Fix GitHub Actions billing — 17+ days broken, now compounded by the separate Vercel-check
   stall. **[needs-founder]**.
10. Decide explicitly whether to reset the 2026-08-05 $10k MRR target — 10 days remain, N-320
    unmoved 20 of the last 22. **[needs-founder]**.
11. Add the missing `docs/finance/outreach.md` approval-log entries (retroactive, mirroring
    `budget.md`'s format) — mechanically **[agents-can-execute]**, but the underlying fact (did
    Oliver actually approve the sends) is **[needs-founder]** to confirm.
12. Fix the board/strategy cron ordering — 4th week running, unfixed. **[agents-can-execute]**.
13. Grant this session's harness Linear connector access (or fix whatever makes it non-interactive-
    unreachable) so board reviews can verify Linear state and post to the standing thread as
    instructed — this run could not complete either. **[needs-founder]** (connector/auth
    configuration, not a repo change).
14. Fold `llmCostUsd` into the B3 unit-economics panel — carried 3rd+ week, still hardcoded `null`.
    **[agents-can-execute]**.
15. Write Product Hunt and X launch drafts (named but never drafted, unlike HN/Reddit/MCP-
    directories) — a real, still-open agent task independent of the founder-blocked posting itself.
    **[agents-can-execute]**.

## 8. Questions for the founder (verbatim, one per lens)

1. "Seats.aero has been silent for 20 days while HOP_ENABLE_BILLING stays on and takes real
   payments against their feed — do you want it off today, or are you making an explicit call to
   keep taking money on this risk?"
2. "You can't publicly name Claude or ChatGPT while at Google — so what is hop's actual plan to win
   MCP-client distribution against Award Travel Finder, and does that constraint change whether MCP
   is even the right channel to keep building for?"
3. "13 PRs have been stuck unmergeable for up to 42 hours on a wedged Vercel check, and the finance
   desk has gone from 5 days silent to 12 — do you want the fleet paused until you personally clear
   N-320 and the merge pipe, or is burning agent runs against a stuck queue and an unanswerable
   ledger acceptable while you decide?"
4. "Can you paste the three drafts sitting in docs/marketing/drafts/ (oldest is now 20 days old) —
   or tell me explicitly to mark community seeding paused so the desk stops re-flagging it?"
5. "Can you fix GitHub Actions billing and whatever's holding the Vercel required check pending for
   24-42+ hours — 13 PRs, including a full new AI support-agent surface, are stuck unverifiable
   until you do, and two more automation PRs will land dead-on-arrival without it?"

Two of the five questions, asked independently, converge on the same underlying ask: **the merge
pipeline itself — not just the seats.aero/billing decision — is now a live, active blocker on
everything the fleet does, and clearing it (or explicitly deciding to pause instead) is now as
urgent as the two founder decisions this board has carried for three consecutive weeks.**

---

## 2026-07-28 — correction (merge pipeline resolved)

Not a new review — an append-only correction to §1/§3's merge-pipeline finding, same convention
as `docs/marketing/funnel-log.md`'s dated corrections. The finding stands as an accurate diagnosis
of 2026-07-26 reality and was independently reconfirmed three more times in the 24 hours after
this memo shipped — the strategy desk's own 2026-07-26 note, the growth desk's 2026-07-27
funnel-log entry ("merge pipeline still wedged," PR #356), and a same-day "sheriff" PR (#345) — a
4-for-4 read across every desk that touched it. PR #352 (2026-07-27) narrowed the root cause to a
GitHub App identity mismatch on the required Vercel status check, not a Vercel outage or a repo
misconfiguration this fleet could fix itself — it needed the repo owner to re-authorize the Vercel
GitHub App under Settings → Integrations.

Oliver fixed it: commit `8bd8356` ("chore: retrigger Vercel deployment check") and the
re-authorization landed around 2026-07-28T04:59 UTC, confirmed by this session watching PR #333
(this memo's own PR) get merged with `main` and its 25-PR backlog drain within hours — PRs #318,
#319, #320, #324, #325, #328, #331, and more all merged in the same window. From first diagnosis
(this memo, 2026-07-26 ~13:00 UTC) to fix (2026-07-28 ~05:00 UTC) was **under 40 hours**, and the
fix itself is now captured for next time: `docs/solutions/2026-07-27-vercel-github-app-identity-split-status-checks.md`.

Not claiming the underlying execution picture from §2 has changed — the seats.aero silence, the
finance desk's silence, and the unposted community drafts are all still open as of this
correction, unaffected by this fix. This correction closes only the merge-pipeline finding
specifically: it was real, it was the right #1 priority, and it is now resolved.
