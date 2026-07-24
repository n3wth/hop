---
title: Weekly invariant audit loop — clean GitHub Action skip on missing secrets and fingerprint deduping
date: 2026-07-24
tags: [self-improvement, github-actions, invariant-audit, CI, automation]
files: [.github/workflows/weekly-audit.yml, scripts/weekly-audit.mjs, lib/__tests__/weekly-audit.test.ts]
status: solved
---

## Problem

Phase 1.5 of the self-improvement loop requires a weekly read-only audit across the repository's invariant domains (`engine`, `degradation`, `copy`, `nextjs16`, `security`, `memory`). When executing as an automated GitHub Action workflow, two key risks exist:
1. **Failing when optional secrets are absent**: Repositories or forks running without an `ANTHROPIC_API_KEY` secret could fail CI/workflows noisily instead of degrading cleanly.
2. **Issue spam on repeated runs**: Automated finding reports must deduplicate against existing open GitHub issues so that recurring weekly runs do not pile up duplicate issue tickets for the same underlying issue.

## Solution

1. **Clean Secret Gate (`.github/workflows/weekly-audit.yml`)**:
   - The GitHub Action job uses `if: ${{ secrets.ANTHROPIC_API_KEY != '' }}` so that fork or unconfigured environments skip the audit job silently without failing the workflow run.
   - The underlying script (`scripts/weekly-audit.mjs`) also checks `process.env.ANTHROPIC_API_KEY` and exits 0 cleanly if absent.

2. **Fingerprint Issue Deduping (`scripts/weekly-audit.mjs`)**:
   - Each audit finding generates a deterministic 10-character hex SHA-256 fingerprint from `${file}:${invariant}:${line}` (`computeFingerprint`).
   - Issues are created with the title convention `[hop:audit:<fingerprint>] <severity>: <invariant> in <file>` and labeled `auto-audit`.
   - Before filing new issues, `fetchOpenAuditIssues` checks existing open `auto-audit` issues via `gh issue list` and `isFingerprintOpen` skips creating duplicate tickets.

3. **Dry-Run Mode & Verification**:
   - Manual triggers (`workflow_dispatch`) default `dry_run` to `true`, outputting findings JSON to logs/step summary without mutating repo issues.
   - Comprehensive unit tests (`lib/__tests__/weekly-audit.test.ts`) verify fingerprint determinism and issue title matching.
