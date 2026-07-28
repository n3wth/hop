# Autonomy run log

- 2026-07-27 · Claude Code (growth desk, scheduled) · weekly funnel-log pull + merge-pipeline
  escalation · PR #356 (docs-only, not merged — see below) ·
  **outcome**: pulled 7d PostHog traffic/funnel (10 visitors, funnel events zero for a 9th+
  consecutive read; this week's 4 nonzero `outclick` events all `$virt_traffic_type: Automation`,
  not real). Investigated whether 4 straight zero-funnel days (7/23–7/27) meant the site was down
  rather than quiet — ruled out, `hop.flights` fetches and renders correctly. **Did not merge
  PR #356** — reconfirmed live (PR #332's status still `Vercel: pending` from the real GitHub App
  hours after opening) that the merge pipeline to `main` has been completely wedged since PR #317
  (2026-07-23T10:48 UTC), now a 4th independent read to find this in 24h after the 7/26 board
  memo, 7/26 strategy memo, and sheriff PR #345. PR #352 (opened same day) traced the likely root
  cause to a GitHub App identity mismatch on the required `Vercel` status check — repo-admin-only,
  no agent can fix it. 25 PRs queued, zero merged in 4 days. Content-pipeline work stayed frozen
  per the board's 7/19/7/26 votes and would be moot regardless (nothing merges right now).
  **lesson**: when every desk's PRs are blocked by the same infra-level cause for multiple days
  running, re-filing it as another memo paragraph has diminishing value — escalated directly via
  push notification this run instead of adding a 5th silent write-up. Linear was unreachable
  (headless, no interactive OAuth) — noted "Linear sync needed" in the PR body per the runbook's
  git-fallback mode.
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
