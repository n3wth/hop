# Autonomy run log

- 2026-07-27 (eleventh sweep same day) · Claude Code (merge-queue sheriff, scheduled) · re-swept
  all 22 currently-open PRs (#318-#357). **Two new PRs since the tenth sweep**: #356
  (`docs(growth): funnel-log entry — merge pipeline still wedged`, opened 15:09 UTC) and #357
  (`docs(retro): weekly retro 2026-07-27`, draft, opened 16:11 UTC) — both docs-only (funnel-log
  and retro markdown respectively), neither touches `lib/db/schema.ts`, `drizzle/**`, a new
  `lib/env.ts` flag, or `vercel.json`, so neither is hold-for-owner. `pull_request_read get` on
  both confirms `mergeable_state: blocked`, same as every other open PR — the fleet-wide stall
  claims them too, no exception. **Root blocker unchanged**: live `get_status` on #331 (oldest
  fix-PR) and #357 (newest) both show the single `Vercel` context still `pending` ("Waiting for
  checks to complete") from the stale app avatar (`.../in/8329`) — #331's frozen since creation
  (`created_at` == `updated_at`, 2026-07-27T01:12:13Z), #357's is a fresh-but-still-pending status
  posted at 16:18:16Z, i.e. the check is retriggering and re-sticking at `pending` on every new
  commit, not just failing to update a stale one. Same root cause as documented in PR #352
  (`docs/solutions/2026-07-27-vercel-github-app-identity-split-status-checks.md`) — unresolved.
  **Hold-for-owner PRs re-confirmed unchanged**: #318 (`HOP_ENABLE_SUPPORT_AGENT`) and #348
  (`HOP_ENABLE_LLM_TRACING`) are still the only two open PRs touching `lib/env.ts` with a new
  flag; both `mergeable_state: blocked`; last PR-comment flags (00:22 and 02:14/02:22 UTC) remain
  inside the 24h no-nag window — no re-nag posted. **No merge/fix/comment actions taken**: every
  non-hold PR is blocked purely on the external Vercel stall, not on code quality; a repeat
  merge/retrigger probe would only reproduce the already-documented `405 ... was not set by the
  expected GitHub app` failure. **No founder notification sent**: this is the 11th consecutive
  sweep since 2026-07-24 reporting the identical unresolved blocker, with a direct out-of-band
  founder ping already sent earlier today and zero owner action or check-state change since —
  the only new information this run (two more docs-only PRs joining the same pile) doesn't change
  the ask or its urgency, so a repeat alert now would be pure noise. Will re-notify only if the
  check state changes or a full 24h passes with zero owner action since that last ping.
  **Linear still unreachable** this session (headless, no interactive OAuth) — git-fallback again,
  appending here per the runbook rather than the standing "Founder review queue" thread.

- 2026-07-27 (tenth sweep same day) · Claude Code (merge-queue sheriff, scheduled) · re-swept all
  20 currently-open PRs (#318-#353) — identical open set to the ninth sweep (which itself closed
  #354/#355 as stale duplicates), zero net change since: no new PRs, none closed/merged/converted
  from draft. **No new information this run**: spot-checked `get_status` on #331 (oldest fix-PR)
  directly — still the single `Vercel` context `pending` ("Waiting for checks to complete", stale
  app avatar `.../in/8329`), `created_at` == `updated_at` (2026-07-27T01:12:13Z), i.e. frozen since
  creation, unchanged from every prior sweep. `get` on both hold-for-owner PRs (#318
  `HOP_ENABLE_SUPPORT_AGENT`, #348 `HOP_ENABLE_LLM_TRACING`) confirms `mergeable_state: blocked` on
  both, unchanged; their last PR-comment flags (00:22 and 02:22 UTC) remain the most recent —
  inside the 24h no-nag window, so no re-nag posted. Also re-checked #353 (newest PR, ADR 0013,
  docs-only) — same `blocked` state as everything else, confirming the stall is still fleet-wide,
  not PR-specific. Classification re-confirmed unchanged: only #318 and #348 touch `lib/env.ts`
  with a new flag among the 20 open PRs; no `lib/db/schema.ts`, `drizzle/**`, or `vercel.json`
  touches found anywhere else. **No merge/fix/comment actions taken**: every non-hold PR is still
  blocked purely on the external Vercel required-status-check stall (root-caused in
  `docs/solutions/2026-07-27-vercel-github-app-identity-split-status-checks.md`, PR #352), not on
  code quality — nothing to fix, and a repeat merge/retrigger probe would only reproduce the same
  already-documented `405 ... was not set by the expected GitHub app` failure. **No founder
  notification sent** (10th consecutive sweep since 2026-07-24 reporting the identical unresolved
  blocker, with a direct out-of-band founder ping already sent earlier today and zero owner action
  or check-state change since — a repeat alert now would be pure noise, not new information). Will
  re-notify only if the check state changes or the PR backlog shows evidence of owner action.
  **Linear still unreachable** this session (headless, no interactive OAuth) — git-fallback again,
  appending here per the runbook rather than the standing "Founder review queue" thread.

- 2026-07-27 (ninth sweep same day) · Claude Code (merge-queue sheriff, scheduled) · full backlog
  sweep of 21 open PRs (#318-#355 minus gaps). **Root blocker unchanged**: spot-checked `get_status`
  on #345 and #352 — every non-hold PR still shows the single `Vercel` context `pending` from the
  stale app avatar (`.../in/8329`), `updated_at` frozen at creation; hold-for-owner PRs #318
  (`HOP_ENABLE_SUPPORT_AGENT`) and #348 (`HOP_ENABLE_LLM_TRACING`) still `mergeable_state: blocked`,
  last flagged 00:22 and 02:14 UTC respectively — both inside the 24h no-nag window, so no re-nag
  posted. **New this sweep — closed 2 more stale-duplicate PRs**: #354 (`docs(plans): viral
  differentiation`) and #355 (`docs(plans): self-improvement loop, AI support, design system`),
  both opened after the eighth sweep. Same failure mode as #323/#329/#335-#342/#344: their Vercel
  check reads `success` because their head commits are old (dated 2026-07-02 in the check
  timestamp) and were checked weeks ago, but `mergeable_state` is `dirty` — real content conflicts,
  not the external stall. Verified directly against `main`@`57c886d`'s `docs/plans/` listing before
  closing: #354's `docs/plans/2026-07-02-viral-differentiation.md` (362-line diff) collides with an
  already-merged 33.9KB version of the identical filename; #355's three files
  (`2026-07-02-ai-support-agent.md`, `2026-07-02-design-component-system.md`,
  `2026-07-02-self-improvement-loop.md`, ~317-line-average diff) all already exist on `main` as
  larger, more mature versions (37KB/34KB/37KB). Closed both with an evidence-linked comment each,
  no code lost — same builder-routine-regenerating-already-shipped-work pattern flagged in the
  fifth-sweep entry below; still worth the fix noted there (diff a picked item's target files
  against `main` before starting work, not just check Linear/PR state). **No merge/fix actions on
  any other PR**: all 17 remaining non-hold, non-draft PRs are still blocked purely on the external
  Vercel check, not on code quality — a repeat live-merge probe would only reproduce the
  already-documented `405 ... was not set by the expected GitHub app` failure. **No founder
  notification sent**: this is now the 9th consecutive sweep since 2026-07-24 reporting the
  identical unresolved blocker; the last direct founder ping was earlier today (before the
  05:34 UTC eighth-sweep) with no owner action since and no change in check state — a repeat ping
  now would be pure noise. Will re-notify only if the check state changes or a full 24h passes
  with zero owner action since that last ping. **Linear still unreachable** this session (headless,
  no interactive OAuth) — git-fallback again, appending here rather than the standing "Founder
  review queue" thread; the two new closures and updated open-PR count should be reflected there
  once a Linear-connected session runs.

- 2026-07-27 (seventh sweep same day) · Claude Code (merge-queue sheriff, scheduled) · re-swept
  all 20 currently-open PRs (#318-#353) — identical open set to the sixth sweep, zero net change
  (no new PRs, none closed/merged). **No new information this run**: spot-checked `get_status` on
  #331 (oldest fix-PR) and #353 (newest PR) directly via the GitHub MCP API — both still show the
  single `Vercel` context `pending` ("Waiting for checks to complete", stale app avatar
  `.../in/8329`) with `updated_at` frozen at creation time; `get` on the two hold-for-owner PRs
  (#318, #348) confirms `mergeable_state: blocked` on both, unchanged. Hold-for-owner
  classification re-confirmed unchanged: only #318 (`HOP_ENABLE_SUPPORT_AGENT`) and #348
  (`HOP_ENABLE_LLM_TRACING`) touch `lib/env.ts` with a new flag among the 20 open PRs; no
  `lib/db/schema.ts`, `drizzle/**`, or `vercel.json` touches anywhere else. Both holds' last
  PR-comment flag remains inside the 24h no-nag window (00:22 and 02:22 UTC respectively) — no
  re-nag posted. **No merge/fix/comment actions taken**: every non-hold PR is still blocked purely
  on the external Vercel required-status-check stall (root-caused and documented in
  `docs/solutions/2026-07-27-vercel-github-app-identity-split-status-checks.md`, PR #352), not on
  code quality — nothing to fix, and a repeat merge/retrigger probe would only reproduce the same
  already-documented failure. **No founder notification sent**: this is now the 8th consecutive
  sweep since 2026-07-24 reporting the identical unresolved blocker, and a direct founder
  notification for this exact stall already went out earlier today with no owner action since —
  a repeat ping this soon would be pure noise, not new information. Will re-notify only if the
  check state changes (resolves, or a new distinct failure appears) or if a full 24h passes with
  zero owner action since the last ping. **Linear still unreachable** this session (headless, no
  interactive OAuth) — git-fallback again, appending here per the runbook rather than the standing
  "Founder review queue" thread.
- 2026-07-27 (sixth sweep same day) · Claude Code (merge-queue sheriff, scheduled) · re-swept all
  20 currently-open PRs (#318-#353; confirms the fifth sweep's post-close count exactly, so zero
  net change in the open set since then — no new PRs, none closed). **No new information this
  run **: spot-checked `get_status`/`get` on #318, #331, #353 (oldest hold, oldest fix-PR, newest
  PR) directly via the GitHub MCP API — all three still show the single `Vercel` context in
  `pending` ("Waiting for checks to complete", stale app avatar `.../in/8329`) and
  `mergeable_state: blocked`, identical to every prior sweep since the root cause was diagnosed.
  Re-confirmed the hold-for-owner classification by diff: only #318 (`HOP_ENABLE_SUPPORT_AGENT`)
  and #348 (`HOP_ENABLE_LLM_TRACING`) touch `lib/env.ts` with a new flag among the 20 open PRs; no
  `lib/db/schema.ts`, `drizzle/**`, or `vercel.json` touches found anywhere else. Both holds were
  last re-flagged within the last 24h (00:22 and 02:14 UTC) — no re-nag posted, per the no-nag
  rule. Lightly reviewed the two PRs opened since the fifth sweep closed its duplicates (#352
  docs-only Vercel-identity-split writeup, #353 docs-only ADR 0013) — both trivially low-risk,
  docs-only, no P1s, but both still blocked on the same external check like everything else.
  **No merge/fix/comment actions taken**: nothing to fix (all 18 non-hold PRs are blocked purely
  on the external check, not code quality) and a repeat live-merge probe would only reproduce the
  same `405 ... was not set by the expected GitHub app` already documented twice below. **No
  founder notification sent**: an earlier sweep today already pushed one for this exact blocker,
  and nothing has changed since (same root cause, same PR count trajectory, no owner action) — a
  second alert would be pure noise, consistent with the fourth sweep's stated reasoning below.
  **Linear still unreachable** this session (headless, no interactive OAuth) — git-fallback again,
  appending here per the runbook rather than the standing "Founder review queue" thread.
- 2026-07-27 (fifth sweep same day, ~04:40 UTC) · Claude Code (merge-queue sheriff, scheduled) ·
  swept all 23 open PRs (#318-#353). **Root blocker unchanged**: spot-checked `get_status` on
  #351/#353 (oldest/newest at sweep start) — same single `Vercel` context, `pending`,
  `updated_at` frozen at creation, `mergeable_state: blocked`. No new action on that front; still
  needs the founder's Vercel↔GitHub-App fix documented in the day-4 entry below and
  `docs/solutions/2026-07-27-vercel-github-app-identity-split-status-checks.md` (added this
  window by a parallel session, PR #352). **New this sweep — closed 3 more stale-duplicate
  PRs**: #349 ("PR 5 — Stat primitive"), #350 ("PR 2 — system digest + D6 dead-watches"), #351
  ("PR 6 — Field/Input/Textarea/Select primitives") all appeared after the day-4 sweep closed
  #323/#329 for the identical reason, and turned out to be the same failure mode recurring: their
  claimed features are already on `main` (verified directly — `components/ui/Stat.tsx` and
  `components/ui/Field.tsx` on `main`@`57c886d` already have the full implementations, and
  `lib/__tests__/health-checks.test.ts` already has the `D6 dead watches` describe block; #349's
  and #351's actual diffs against `main` were 1 file each of trivial test whitespace, #350's diff
  was empty). Closed all three with an evidence-linked comment each, no code lost. **This
  strongly suggests a builder routine (likely "hop autonomous dev", every 6h) is regenerating
  already-shipped self-improvement/design-system work** — plausibly because the multi-day merge
  stall means it can't tell what's landed from merged-PR history and is re-picking the same
  queue items. Worth a rule: before starting a picked item, diff its target files against `main`
  first, not just check Linear/PR state. Classification re-confirmed: only #318 and #348 touch
  `lib/env.ts` with a new flag among the 23 open PRs; both were last re-flagged within the last
  24h (00:22 and 02:14 UTC respectively) so no re-nag posted, consistent with the no-nag rule.
  #333/#334 remain draft, unchanged. **No merge/fix actions on non-hold PRs**: all still blocked
  on the same external check. **Linear still unreachable** this session (headless, no interactive
  OAuth) — git-fallback again, appending here per the runbook rather than the standing Linear
  thread; the closed-duplicate-PRs and updated PR count should be reflected in the Linear
  "Founder review queue" issue once a Linear-connected session runs.
- 2026-07-27 (fourth sweep same day, ~04:13 UTC) · Claude Code (merge-queue sheriff, scheduled) ·
  independently re-verified the identical blocker via the GitHub MCP API (not `gh`, which this
  session doesn't have): pulled fresh `get_status`/`get` on the oldest fix PR (#331) and the newest
  hold-for-owner PR (#348) — both still show a single `Vercel` context in state `pending`
  (`"Waiting for checks to complete`", avatar `.../in/8329`) with `updated_at` frozen at creation
  time, and both PRs' `mergeable_state` is `blocked`. Confirmed the file-diff classification
  independently too: #318 (`HOP_ENABLE_SUPPORT_AGENT`) and #348 (`HOP_ENABLE_LLM_TRACING`) are the
  only two of the 18 open PRs that touch `lib/env.ts` with a new flag, matching the prior sweep's
  hold-for-owner list exactly — no new hold candidates, no new schema/drizzle/`vercel.json` touches
  found in any other PR's diff. Checked both hold-for-owner PRs' comment threads directly: #318 was
  last re-flagged 2026-07-27T00:22 UTC ("day 5", ~4h before this sweep) and #348 at
  2026-07-27T02:14 UTC (~2h before) — both inside the 24h no-nag window, so this sweep posted no
  new PR comments. **No merge/fix actions taken**: every non-hold PR is blocked on the external
  check, not on code quality, and a live merge attempt has already failed identically in an earlier
  sweep today (`405 ... was not set by the expected GitHub app`) — retrying would just reproduce
  that. **Did not send another founder notification**: an earlier sweep today already pushed one for
  this exact blocker (see the entry below), and nothing has changed since — no new PRs, no owner
  action, no shift in check state — so a second alert would be pure noise, not new information.
  **Linear still unreachable** this session (MCP requires interactive OAuth) — git-fallback again,
  appending here per the runbook rather than the standing Linear thread.
- 2026-07-27 (third sweep same day) · Claude Code (merge-queue sheriff, scheduled) · re-swept
  all 18 currently-open PRs (#318-#348; #323/#329/#335-#342/#344 confirmed gone — closed by the
  prior sweep) · **no change from the previous two entries below**: spot-checked `mergeable_state`
  across the oldest (#318, #319), newest (#45-#348), and both drafts (#333, #334) — every
  non-draft PR is still `blocked` (or `unstable` for #334) on the same wedged `Vercel` check first
  diagnosed two sweeps ago; #333/#334 are still draft, unchanged. Zero new PRs since #348. Took no
  merge/fix/comment actions this run — re-commenting on #318/#348 (already flagged <24h ago) or
  re-diagnosing oan already-root-caused, needs-founder external stall would only add noise, and a
  live merge attempt would fail the same way it did in the prior sweep. **Linear still
  unreachable** this session too — the MCP connector needs interactive re-authorization
  (`claude mcp`/`/mcp`), which a headless scheduled run cannot perform; falling back to this log
  again per the runbook. **This is now the 7th consecutive sweep (since 2026-07-24) reporting the
  identical unresolved blocker** — pushed a direct notification to the founder this run given the
  repeated non-response in the PR-comment channel, per the prior entry's own recommendation.
- 2026-07-27 (later same day) · Claude Code (merge-queue sheriff, scheduled) · full sweep of 19
  open PRs (#318-#347) · **root cause from the earlier entry below is still unresolved** — every
  PR checked this run (17 of 19) shows the same `Vercel` check stuck `pending` from the
  broken-GitHub-App-identity mismatch (`.../in/8329`, the stale app), including PRs opened only
  minutes before this sweep (#346, #347) — this has now gone unresolved across 6 consecutive
  sweeps since 2026-07-24 and needs the founder to fix branch protection on `main` (Settings →
  Branches → required status checks → remove/re-add "Vercel", or reinstall the GitHub App) since
  no repo-side workflow controls it. **New this run**: closed #323 and #329 as confirmed stale
  duplicates — both PRs' actual content (Stat primitive/`lib/format.ts` via commit `6dd29a9`
  #307; Field/Input/Textarea/Select primitives via commit `cbfb549`, identical title) was already
  on `main`, and #323's remaining diff would have been a real regression (an older `Select` test
  API shape) had it ever auto-merged — this had been recommended by name in two prior sweeps
  (2026-07-25, 2026-07-26) without being executed; executing now since the risk of closing
  (reversible, branch preserved) is lower than leaving a regression-risk PR armed in the queue.
  Reviewed the two brand-new PRs since the last sweep (#346 admin cron-heartbeat fix, #347
  points-band search-date fix, both from `charliecreates[bot]`) — clean, tests included, zero
  P1s, auto-merge armed (SQUASH) on both plus on this log PR (#345) itself. #318 remains
  hold-for-owner (new `HOP_ENABLE_SUPPORT_AGENT` flag in `lib/env.ts`) — already flagged <24h ago,
  not re-nagged this run per the 24h rule. #333/#334 (draft board/strategy memos, #334 stacked on
  #333's branch) unchanged, still blocked the same way. **Linear still unreachable** (headless,
  no interactive OAuth) — appending here per the runbook's git-fallback mode, same as every prior
  entry in this chain. **Escalating**: this is now a 4+ day, ~19-PR pileup from a ~2-minute owner
  fix — worth a direct ping outside the PR-comment channel given repeated non-response there.
  **PR #348 opened mid-sweep** (LLM tracing privacy hardening, refs #344) — also hold-for-owner,
  adds a new `HOP_ENABLE_LLM_TRACING` flag to `lib/env.ts`; flagged on the PR directly.
- 2026-07-27 · Claude Code (merge-queue sheriff, scheduled) · PR backlog sweep (25 open PRs,
  #318-#344) · **root cause found for the stuck merge pipeline the 2026-07-26 board/strategy
  memos flagged**: the `Vercel` required status check is NOT down/failing — it's genuinely
  wedged in `pending` ("Waiting for checks to complete") on the GitHub side and never resolves,
  confirmed by pushing a brand-new empty commit to PR #331 and watching its fresh commit SHA get
  the exact same stuck-pending status a minute later (`docs/ops-runbook.md`'s "Required PR check
  is the Vercel build" — so this alone blocks 100% of merges). This is external to the repo (no
  workflow/config file controls it) — **needs-founder**: check the Vercel↔GitHub App integration
  in the Vercel dashboard (Project Settings → Git) for a broken webhook/permission, since retrying
  from this side does nothing. Separately, PR #331 also had its OWN one-off issue: its original
  Vercel status was posted by an OAuth App (id 1157143) instead of the installed Vercel GitHub App
  (id 8329) that branch protection requires — merge attempt failed with "status check was not set
  by the expected GitHub app"; the retrigger push fixed the app-identity issue (new status now
  correctly from id 8329) but is still stuck pending on the same root-cause stall. **~14 PRs
  blocked on this alone**: #318, #319, #320, #321, #323, #324, #325, #327, #328, #329, #330, #331,
  #332, #343 — none are hold-for-owner by diff (no `lib/db/schema.ts`, `drizzle/**`, new
  `lib/env.ts` flag, or `vercel.json` touches in any of them), all otherwise look mergeable once
  Vercel resolves. **#333 and #334 are a separate case**: both are still marked draft (opened/last
  updated 2026-07-26, unchanged this run) — draft state is its own blocker independent of the
  Vercel stall, so they are NOT simply "mergeable once Vercel resolves" like the other 14; #334 is
  also stacked on #333's branch (`board/2026-07-26`), not `main`, so #333 must land first either
  way. Neither was marked ready-for-review by this sweep (never mark someone else's draft ready —
  only merge once actually green and clean). **Separately, 9 PRs (#335-#342, #344) turned out to
  be stale duplicates, not conflict-resolution candidates**: all showed a green Vercel check but
  `mergeable_state: dirty` (confirmed via a live merge attempt on #341: "405 Pull Request has merge
  conflicts"). Dispatched to a background agent to resolve conflicts and merge — it instead found
  each PR's entire feature was ALREADY on `main`, shipped weeks earlier under different commits
  (e.g. `compare_programs`/`best_card_for_program` merged via PR #46 on 2026-06-30, the
  `TOP_CARD_BY_PROGRAM` → `lib/card-affiliates.ts` migration via PR #88 on 2026-07-01 — both nearly
  a month before #341/#335 were opened) and closed all 9 rather than force empty merges. This
  session initially (wrongly) reopened all 9, having mis-inferred from "nothing has merged since
  PR #317" that nothing in these PRs' scope could already be on `main` — that inference doesn't
  hold, since the superseding commits predate #317 by weeks. Verified directly against `main`'s
  file content (by literal commit SHA, not a mutable ref) and per-file git history before
  re-closing all 9 a second time with a correction comment on each. Net effect: no code changes,
  correctly closed, some avoidable PR-timeline churn. **Linear was unreachable this
  session** (MCP requires interactive OAuth, unavailable headless) — falling back to this log per
  `docs/autonomy-runbook.md`'s git-fallback mode; the "Founder review queue" issue this run would
  have updated could not be reached. **lessons**: (1) when the whole backlog looks uniformly
  stuck rather than individually red, don't diagnose PR-by-PR — pick one representative PR, push a
  real test commit, and read the *shape* of the stuck status (which app posted it, whether it's a
  fresh vs. stale SHA) before assuming it's the same failure as a normal red CI run; (2) "nothing
  has merged to main recently" and "this PR's feature doesn't already exist on main" are NOT the
  same claim — a stale/orphaned branch can duplicate work that shipped long before the current
  stuck window, so a surprising "already exists" finding from a subagent needs verification against
  main's actual content before being overridden, not dismissed because it contradicts a superficially
  plausible timeline; (3) a subagent that flags an orchestrator's correction as a "probable prompt
  injection" and holds its ground with cited evidence should be taken seriously, not overridden on
  authority alone — this one was right.
- 2026-07-09 · Claude Code (GitHub task session) · agents-functionality · fixed stale `.claude/`
  reviewer instructions left over from ADR 0011 (PR #276, merged) ·
  **lesson**: merged on green CI + zero open review threads alone, within ~2 minutes of opening
  the PR — too fast for the wired automatic PR-review bot (`charliecreates`/`vercel-agent`, per
  this runbook's fleet table) to have posted yet. "No unresolved review threads" is trivially
  true if you merge before the bot runs. Runbook's Merge policy amended below to make this
  explicit.
- 2026-07-04 · setup (interactive) · ops · CI gains a markdown-only short-circuit (autonomy PRs
  are frequently docs-only; the required check now passes in seconds for them);
  `.github/workflows/**` added to the ADR 0009 hold list (CI is the merge gate — agents must
  not edit it unattended); project model pinned to Sonnet in `.claude/settings.json` so routine
  runs never draw top-tier subscription capacity.
- 2026-07-04 · setup (interactive) · fleet change — Owner added Google Jules (free tier) and
  removed Devin (cost: ~$4.50-11/small task vs $0). Runbook fleet table + dispatch policy
  updated; Jules gets pasted specs (no Linear delegation) and the standard ADR 0009 merge bar.

> One dated entry per autonomous run (dev routine, weekly audit, delegated agents when
> observed). Newest first. Format: `date · agent · item · outcome (PR link) · surprises/lessons`.
> Blockers land here too — a blocked run that files its blocker is a successful run.

- 2026-07-04 · setup (interactive) · — · Runbook adopted; routines "hop autonomous dev" (every
  6h) and "hop weekly invariant audit" (Sun 14:00 UTC) created; N-303 marked Cursor-ready (MCP
  delegation silently no-ops — owner delegates in the Linear UI; captured as a runbook
  amendment). · Headless sessions lack Linear connector + `LINEAR_API_KEY`, so runs may operate
  in git-fallback mode until the key is added to the environment.
