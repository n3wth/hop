---
title: "Roadmap 'done' claims and plan proposals both need a code check, not a document read"
date: 2026-07-05
tags: [roadmap, planning, verification, mcp, admin]
files: ["app/api/[transport]/route.ts", app/admin/users/page.tsx, lib/subscription.ts]
status: solved
---

**What happened, both directions in the same session:**

1. A roadmap item claimed "B2 MCP quota tiers done." It wasn't: `checkRateLimit`
   in `app/api/[transport]/route.ts` uses one flat `MCP_RATE` for every caller,
   and `getUserTier` (`lib/subscription.ts`) is never imported in that file —
   grep confirms it (`grep -rn getUserTier app lib` finds it wired into
   `app/actions/standing-orders.ts` and `app/account/page.tsx`, never the MCP
   route). No per-tier enforcement exists.
2. A plan proposed *building* an admin users directory. It already fully
   exists: `app/admin/users/page.tsx`, `app/admin/users/[id]`,
   `components/admin/UsersTable.tsx`, `components/admin/UserDetail.tsx`.

Both are the same mistake in opposite directions: trusting a document's
description of the codebase's state instead of checking the codebase.

**Rule (applies both ways):**
- Mark a roadmap/plan item **done** only with a commit or PR link attached —
  not a description of intended behavior.
- Before proposing to **build** something, verify it doesn't already exist:
  grep for the feature's obvious symbol/route/component name first. A plan
  that starts with "add X" should start with "grep for X."
