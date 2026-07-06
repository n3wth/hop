---
title: "A half-resolved merge conflict landed straight on main and blocked all PR CI"
date: 2026-07-05
tags: [git, merge-conflicts, main, ci, branch-protection, cron]
files: [app/api/cron/business-digest/route.ts, lib/business-digest.ts, lib/__tests__/business-digest.test.ts]
status: solved
---

**What happened:**
Merge commit `6dc3e20` ("Merge branch 'claude/business-digest'") merged a stale
reimplementation of the business-digest feature into `main` and left conflict
markers uncommitted-away in three files. A follow-up commit, `c7faf84` ("Fix
merge conflicts in business-digest"), pushed straight to `main` claiming to fix
it, but:

1. Never touched `app/api/cron/business-digest/route.ts` at all — it still had
   4 literal `<<<<<<< HEAD` / `=======` / `>>>>>>> origin/claude/business-digest`
   blocks.
2. Resolved `lib/business-digest.ts` and its test by picking the *older*,
   stale branch's simpler `BusinessDigest` shape over main's richer one
   (`activeUsers`, per-metric `trend` sparklines, `outclicks`) —
   `components/admin/AdminDashboard.tsx` (already merged, unrelated to this
   branch) depended on the richer shape and broke with 8 new typecheck errors.

Both landed directly on `main` with no PR, no CI gate, and no `npm run check`.
Every open PR's required Vercel check started failing against a broken `main`
for hours until fixed by #212 (`62210a0`).

**How the correct side was determined (evidence, not preference):**
- Every other `app/api/cron/*` route (`balance-autosync`, `health-sentinel`,
  `revalidate-seo`, `standing-orders`, `valuation-sync`) already used
  `isAuthorizedCron` (`lib/cron-auth.ts`) + `recordHeartbeat`
  (`lib/cron-heartbeat.ts`, ADR 0007) — that was the HEAD side of the
  `route.ts` conflict, not the inline `isAuthorized()` reimplementation on the
  other side.
- `AdminDashboard.tsx` on main rendered `digest.activeUsers`,
  `digest.outclicks`, and `metric.trend` — fields only present in the
  pre-merge `main` version of `lib/business-digest.ts`.

**Preventions now in place:**
- Branch protection on `main`, set 2026-07-05: required Vercel status check +
  `enforce_admins: true` (verified via
  `gh api repos/n3wth/hop/branches/main/protection`) — a broken commit can no
  longer land on `main` without passing CI, admins included.
- **Rule:** after resolving any merge conflict, `grep -rn '^<<<<<<<\|^=======$\|^>>>>>>>' <touched files>`
  and run `npm run check` **before** pushing — not after.
- **Rule:** when two branches implement the same module differently, the side
  that matches established patterns and existing consumers wins — check what
  every sibling route/component already does and who reads the data
  (`grep -rn` the field names), don't guess from the diff alone.
