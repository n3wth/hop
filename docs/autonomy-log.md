# Autonomy run log

- 2026-07-29 · Claude Code (growth desk, scheduled) · weekly funnel-log pull + merge-pipeline
  resolution confirmed · PR #372 (docs-only) ·
  **outcome**: pulled 7d PostHog traffic/funnel (7 visitors, `signed_up`/`first_program_added`
  zero for a 24th consecutive day; this week's 5 nonzero `outclick` events all
  `$virt_traffic_type: Automation`, not real — same false-positive pattern as 7/18/7/22, correctly
  downgraded). **The merge-pipeline stall escalated in the last four reads (board memo, strategy
  review, sheriff sweep, 7/27 funnel-log) is resolved** — verified against `main`'s commit history:
  11 PRs merged in a one-minute burst at 2026-07-27T21:59 PT after 4 days of zero merges, and
  merges have continued normally since (PR #371 at 2026-07-28T22:57 PT). Re-verified the
  MCP-directory submission blockers from the 7/17 draft against the live page rather than assuming
  stale: PulseMCP now surfaces a `/submit` form, but it's behind a Cloudflare bot-challenge (403
  even with a browser UA) — still no unattended path. **lesson**: re-verify externally-blocked
  items against current state periodically rather than re-flagging from memory — directories and
  infra both change underneath a stale finding, in both directions (this run found one blocker
  resolved and one unchanged).
- 2026-07-27 · Charlie · admin cron health semantics · opened replacement PR
  https://github.com/n3wth/hop/pull/346 so an unavailable heartbeat read renders one explicit
  unknown state while successful empty reads still render `never run` rows · **lesson**: preserve
  `null` as unavailable at the presentation boundary when sibling telemetry can load independently.
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
