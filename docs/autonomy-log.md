# Autonomy run log

- 2026-07-27 (fourth sweep same day, ~04:13 UTC) · Claude Code (merge-queue sheriff, scheduled) ·
  independently re-verified the identical blocker via the GitHub MCP API (not `gh`, which this
  session doesn't have): pulled fresh `get_status`/`get` on the oldest fix PR (#331) and the newest
  hold-for-owner PR (#348) — both still show a single `Vercel` context in state `pending`
  (`"Waiting for checks to complete"`, avatar `.../in/8329`) with `updated_at` frozen at creation
  time, and both PRs' `mergeable_state` is `blocked`. Confirmed the file-diff classification
  independently too: #318 (`HOP_ENABLE_SUPPORT_AGENT`) and #348 (`HOP_ENABLE_LLM_TRACING`) are the
  only two of the 18 open PRs that touch `lib/env.ts` with a new flag, matching the prior sweep's
  hold-for-owner list exactly — no new hold candidates, no new schema/drizzle/`vercel.json` touches
  found in any other PR's diff. Checked both hold-for-owner PRs' comment threads directly: #318 was
  last re-flagged 2026-07-27T00:22 UTC (\"day 5\", ~4h before this sweep) and #348 at
  2026-07-27T02:14 UTC (~2h before) — both inside the 24h no-nag window, so this sweep posted no
  new PR comments. **No merge/fix actions taken**: every non-hold PR is blocked on the same external
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
  across the oldest (#318, #319), newest (#345-#348), and both drafts (#333, #334) — every
  non-draft PR is still `blocked` (or `unstable` for #334) on the same wedged `Vercel` check first
  diagnosed two sweeps ago; #333/#334 are still draft, unchanged. Zero new PRs since #348. Took no
  merge/fix/comment actions this run — re-commenting on #318/#348 (already flagged <24h ago) or
  re-diagnosing an already-root-caused, needs-founder external stall would only add noise, and a
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
- 2026-07-04 · setup (interactive) · fleet change · Owner added Google Jules (free tier) and
  removed Devin (cost: ~$4.50–11/small task vs $0). Runbook fleet table + dispatch policy
  updated; Jules gets pasted specs (no Linear delegation) and the standard ADR 0009 merge bar.

> One dated entry per autonomous run (dev routine, weekly audit, delegated agents when
> observed). Newest first. Format: `date · agent · item · outcome (PR link) · surprises/lessons`.
> Blockers land here too — a blocked run that files its blocker is a successful run.

- 2026-07-04 · setup (interactive) · — · Runbook adopted; routines "hop autonomous dev" (every
  6h) and "hop weekly invariant audit" (Sun 14:00 UTC) created; N-303 marked Cursor-ready (MCP
  delegation silently no-ops — owner delegates in the Linear UI; captured as a runbook
  amendment). · Headless sessions lack Linear connector + `LINEAR_API_KEY`, so runs may operate
  in git-fallback mode until the key is added to the environment.
