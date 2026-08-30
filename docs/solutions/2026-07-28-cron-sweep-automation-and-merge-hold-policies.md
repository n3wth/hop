---
title: "Autonomous cron sweep execution, local pre-ship gates, and ADR 0009 hold list enforcement"
date: "2026-07-28"
problem: "Automated cron routines sweeping open pull requests need to safely classify which branches can be auto-merged versus which must be held for founder review, even when external GitHub App status check integrators are wedged or failing."
cause: "ADR 0009 defines strict hold-for-owner rules covering workflow changes (`.github/workflows/**`), database migrations (`drizzle/**`), environment flags (`lib/env.ts`), dependency lockfiles, and money/auth paths. When GitHub App integrations diverge, status check rollups can remain pending indefinitely on GitHub."
solution: "Run full local pre-ship verification (`npm run check`) as the local source of truth for build correctness, enforce ADR 0009 hold classification without exception on candidate PRs, and log exact hold reasons for founder review."
tags: [autonomy, ci, github-actions, adr-0009, verification]
---

# Autonomous cron sweep execution, local pre-ship gates, and ADR 0009 hold list enforcement

## Context

During scheduled maintenance sweeps across the `hop.flights` repository, autonomous agent sessions audit open pull requests, verify newly implemented features, check queue state, and process merges per ADR 0009 policies.

When external GitHub status checks (such as required Vercel status checks) are stuck or mismatched due to GitHub App identity changes, agents must avoid guessing or force-bypassing hold policies.

## Key Lessons

1. **Local pre-ship verification (`npm run check`) is non-negotiable**:
   Before evaluating PR merge eligibility or reporting state, agents must execute the full local check suite (`npm run db:check-migrations`, `npm run lint`, `npm run typecheck`, `npm test`). Local verification ensures code correctness independently of external API state.

2. **Strict ADR 0009 hold list enforcement**:
   PRs touching `.github/workflows/**` (such as PR #362 modifying `data-refresh.yml`), `drizzle/**`, `lib/env.ts` flags/keys, or billing/auth paths **must** be held for owner review regardless of how green local checks or CI rollups are. An agent must never auto-merge held paths.

3. **Autonomous queue progression without duplicate work**:
   When PRs are held for founder review or stuck behind branch protection rules, agents check that merged features (such as self-improvement PRs 1-2, design system primitives, viral verdict receipts) are not re-implemented. Instead, lessons and verification logs are recorded systematically.
