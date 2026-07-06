---
title: "A planning document's claims about the codebase need a code check, not a trusting read"
date: 2026-07-05
tags: [roadmap, planning, verification, mcp, admin]
files: ["app/api/[transport]/route.ts", app/admin/users/page.tsx, lib/subscription.ts]
status: solved
---

**What happened, in both directions, in the same session:**

1. A roadmap document (a plain-language plan of upcoming work) claimed a feature was already
   finished: usage limits that scale by subscription tier for the app's API access point.
   Checking the actual code showed this wasn't true — every caller was subject to the exact same
   flat limit, and the function that looks up a user's paid tier was never even called from that
   code path. Searching the codebase for that function's name (`getUserTier`) found it wired up
   in two other places, but not the one the roadmap claimed was done.
2. A separate plan proposed *building* an admin page listing all users. It already fully existed
   — a page, a per-user detail view, and the two supporting components were already written and
   working.

Both mistakes are the same error pointed in opposite directions: trusting a document's
description of what the code does, instead of checking the code itself.

**Why it matters:**
A planning document is a claim about reality, not reality itself — it can drift out of date the
moment the code changes without the document being updated. Trusting a false "done" wastes real
usage capacity going unprotected (tier limits silently didn't apply to anyone). Trusting a false
"not built yet" wastes work rebuilding something that already exists.

**The rule going forward (applies both ways):**
- Mark a roadmap or plan item **done** only when it's backed by a specific commit or completed
  pull request — not by a description of the intended behavior.
- Before proposing to **build** something, search the codebase for it first — the function name,
  route path, or component name it would obviously have. A plan that starts with "add X" should
  start with "check whether X already exists."
