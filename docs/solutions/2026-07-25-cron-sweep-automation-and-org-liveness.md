---
title: Automated PR Queue Management and Data Refresh Workflow Hardening
date: 2026-07-25
tags: [github-actions, cron, auto-merge, data-refresh, verification]
files: [.github/workflows/data-refresh.yml, docs/solutions/2026-07-24-data-snapshot-invariants-and-refresh-loop.md]
status: solved
---

## Problem
During scheduled 3-hour maintenance sweeps:
1. PRs verified with green local checks were blocked from merging immediately when external webhook checks (such as Vercel preview deploys) were pending.
2. The monthly data refresh workflow (`.github/workflows/data-refresh.yml`) required SHA pinning, PAT-scoped checkout (`HOP_BOT_TOKEN`), and exact-match guards around `sed` string replacements to prevent multi-line corruption.

## Solution
1. **GitHub Auto-Merge Queue Mitigation**: Instructed GitHub to auto-merge verified PRs (`gh pr merge <number> --auto --squash`) as soon as required status checks finish, preventing sweep sessions from stalling on pending webhooks.
2. **L3 Data Refresh Workflow Hardening**: Restored SHA-pinned Action commits, PAT-scoped checkout (`HOP_BOT_TOKEN || GITHUB_TOKEN`), concurrency controls (`group: data-refresh`), and added pre- and post-validation checks around `sed` replacements for `CONTENT_LAST_MODIFIED` in `lib/seo-routes.ts`.

## How this compounds
- Maintenance sweeps do not stall waiting on pending external webhooks; auto-merge completes the PR lifecycle asynchronously upon check resolution.
- The dataset refresh workflow runs predictably on schedule with strict path guards and verified syntax checks.
