---
title: Automated PR Sweep Management and Fail-Closed Org-Liveness Watchdog Verification
date: 2026-07-25
tags: [github-actions, cron, auto-merge, liveness-watchdog, verification]
files: [scripts/hermes/hop-org-liveness.sh, scripts/verify-desk-run.mjs, .github/workflows/data-refresh.yml]
status: solved
---

## Problem
During scheduled 3-hour cron maintenance runs across `n3wth/hop`:
1. PRs approved with green local checks remained unmerged when external required status checks (such as Vercel preview deploys) were pending or lagging.
2. The org-liveness watchdog script (`scripts/hermes/hop-org-liveness.sh`) previously relied on branch recency alone, which false-posited deleted branches as "silent" and could not verify whether a desk run produced a valid, green PR or a failed build.
3. The monthly data refresh workflow (`.github/workflows/data-refresh.yml`) lacked SHA pinning, PAT-scoped checkout, and exact-match count guards for `CONTENT_LAST_MODIFIED`.

## Solution
1. **GitHub Auto-Merge Queue**: Executed `gh pr merge <number> --auto --merge` on all green, approved PRs. GitHub automatically merges each PR as soon as Vercel's required check completes, preventing cron session stalls.
2. **Deterministic Desk Verification**: Rebuilt `scripts/hermes/hop-org-liveness.sh` to delegate verification to `scripts/verify-desk-run.mjs` (`npm run verify:desk`). The watchdog now verifies that each autonomous desk's run has an open/merged PR matching the branch HEAD SHA and that all status checks are passing.
3. **L3 Data Refresh Workflow Hardening**: Restored SHA-pinned Action commits, PAT-scoped checkout (`HOP_BOT_TOKEN || GITHUB_TOKEN`), concurrency control (`group: data-refresh`), and added `grep -c` pre- and post-validation checks around `sed` string replacements for `CONTENT_LAST_MODIFIED` in `lib/seo-routes.ts`.

## How this compounds
- Scheduled maintenance runs do not wait on external status webhooks; auto-merge manages the queue out-of-band as checks finish.
- The org-liveness watchdog fails closed if a desk run crashes, fails CI, or stops before opening a PR.
- The dataset refresh workflow runs safely on schedule with strict path guards and verified syntax checks.
