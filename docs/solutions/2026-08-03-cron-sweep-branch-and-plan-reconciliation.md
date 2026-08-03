---
title: "Cron sweep audit — branch reconciliation, ADR 0009 hold policies, and verification"
date: "2026-08-03"
tags:
  - cron
  - autonomy
  - pr-pipeline
  - git
  - adr-0009
---

# Cron sweep audit — branch reconciliation, ADR 0009 hold policies, and verification

## Context

During the scheduled 3-hour cron sweep across `hop.flights`, we performed a comprehensive audit across open PRs, local feature/agent branches, and queued plan items from `docs/plans/`.

## Key Findings & Lessons Learned

### 1. Branch Reconciliation against `main`

A git branch with commits "ahead" of `origin/main` does not necessarily mean work is pending. During the sweep, several branches (`auto/points-band-pages-1782947887`, `auto/wallet-dollar-value-1782926032`, `claude/plan-docs`, `feat/shareable-verdict-receipts`, `feat/self-improve-pr3-data-refresh`) had local commits not on `origin/main`.

Checking `gh pr list --head <branch> --state all` revealed:
- `feat/shareable-verdict-receipts`: Feature was already landed on `main` via PR #253 (`feat(receipts): R1.5 verdict receipts — /v/[id] share pages + OG cards`).
- `feat/self-improve-pr3-data-refresh`: Landed via PR #362.
- `auto/points-band-pages-*` & `auto/wallet-dollar-value-*`: PRs #336 and #337 were closed because their underlying functions were merged into `main` via later PRs (#104 and #89).

**Lesson**: Always check `git log origin/main..<branch>` and search the `main` codebase for the implementation before creating new PRs or re-implementing work from un-merged branches.

### 2. Strict Adherence to ADR 0009 Hold List

PR #373 (`chore(autonomy): revert PR #362 — merged in violation of ADR 0009, flip auto-merge off`) modifies `.github/workflows/data-refresh.yml` and `docs/autonomy-runbook.md`.

Under ADR 0009, files in `.github/workflows/**` and `docs/autonomy-runbook.md` are explicitly on the **Hold-for-Owner** list. Unattended autonomous runs must not auto-merge held PRs, even if CI passes. The sweep correctly left PR #373 in the OPEN state for human owner action.

### 3. Verification Integrity

Running `npm run check` (121 test files, 1414 tests passing) and `npm run build` (161 static/dynamic pages compiled) verified that the main branch and active worktrees maintain 100% check cleanliness and build stability.

## Verification

- `npm run check` passed completely.
- `npm run build` completed cleanly without type or SSR compilation errors.
