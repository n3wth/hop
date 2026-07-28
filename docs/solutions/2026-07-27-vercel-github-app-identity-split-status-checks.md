---
title: "GitHub status check blockage from Vercel GitHub App vs OAuth App integration split"
date: "2026-07-27"
problem: "PRs with passing Vercel deployments and green local checks were blocked from merging via the GitHub API with 'Required status check Vercel is pending' or 'Required status check Vercel was not set by the expected GitHub app'."
cause: "GitHub repository branch protection was configured to require a status check named 'Vercel' associated with the official Vercel GitHub App installation (`in/8329`). When Vercel posted status events using a secondary OAuth App identity (`oa/1157143`), GitHub recorded the status under a different context than the required branch protection rule, keeping the required check permanently stuck in a pending state on GitHub's API."
solution: "For autonomous agent workflows, verify diffs locally using `npm run check` and `npm run build` as the pre-ship gate (per `docs/ops-runbook.md`). Re-authorize or reinstall the official Vercel GitHub App integration in repo settings to align status check contexts and allow API-driven merges."
tags: [ci, github-actions, vercel, branch-protection, autonomy]
---

# GitHub status check blockage from Vercel GitHub App vs OAuth App integration split

## Context

When merging pull requests autonomously via `gh pr merge` or GitHub GraphQL API, merges were rejected with the error:
`GraphQL: Required status check "Vercel" is pending` or `405 Required status check "Vercel" was not set by the expected GitHub app`.

Inspecting raw status check payloads revealed that Vercel was actively completing builds and posting `success` deployment statuses, but posting them under OAuth App context (`oa/1157143`) rather than the expected GitHub App context (`in/8329`).

## Key Lessons

1. **GitHub status checks are identity-bound**:
   A status check name matching `Vercel` is not enough for GitHub branch protection if the required check was registered against a specific GitHub App ID. Statuses posted by OAuth apps or different app instances will be ignored by GitHub's policy evaluator.

2. **Local pre-ship verification is the source of truth**:
   When external status pipelines wedge, run `npm run check` (typecheck, lint, unit tests) and `npm run build` locally within isolated worktrees to verify code correctness independently of webhook/app state.

3. **Remediation path**:
   - Verify deployment health on Vercel directly.
   - Re-link/re-authorize Vercel's GitHub App integration in GitHub Repository Settings → Integrations → Vercel so deployment status callbacks emit under the primary GitHub App installation ID.
