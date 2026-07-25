---
title: Managing GitHub Auto-Merge Queue when External Integration Checks Lag
date: 2026-07-25
tags: [github-actions, auto-merge, vercel, merge-queue, ci]
files: [docs/plans/2026-07-02-design-component-system.md]
status: solved
---

## Problem
When running automated PR sweeps, merging PRs manually can be blocked when external webhook status checks (such as Vercel preview deployments) lag in a `pending` state despite the code and local checks being fully verified.

## Symptoms
`gh pr merge <number> --admin --squash` fails with `GraphQL: Required status check "Vercel" is pending` or base branch policy restrictions, blocking the automated sweep from completing immediately.

## Root cause
External status checks are required by repository branch protection rules before a PR can be merged into `main`. When external platform webhooks are slow to report back final statuses to GitHub, direct merge commands fail immediately.

## Solution
Enable auto-merge on all approved, green PRs (`gh pr merge <number> --auto --squash --delete-branch` or `--merge`). This instructs GitHub to queue the PR for auto-merging the exact moment the required status check transitions to success.

## How this compounds
- Scheduled cron sweeps do not stall waiting on pending external webhooks; enabling `--auto` ensures the pull request auto-merges out-of-band as soon as Vercel finishes.
- Prevents manual admin overrides that bypass required branch protection rules.
