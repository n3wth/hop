# Reviewer: security

Runs on diffs touching: `app/api/**`, `lib/auth*`, `lib/session*`, `middleware.*`,
`.env*`, anything reading `process.env`, any client component (`"use client"`).

Findings return as JSON: `{file, line, severity: "P1"|"P2"|"P3", claim, evidence}`.
Every finding faces a skeptic pass before a human sees it — cite the exact line.

## Checks

1. **Secrets never reach the client.** No `process.env.<SECRET>` in a `"use client"` file
   or anything it imports; only `NEXT_PUBLIC_*` may appear client-side. Grep the diff for
   `process.env` and walk each hit's module boundary. → P1
2. **Every DB query is scoped to the authenticated user** in code (not RLS alone). A query
   on a user-owned table without a `userId` predicate from the session → P1.
3. **Route handlers check authorization**, not just authentication — verify the resource
   belongs to the caller, not merely that a session exists. → P1
4. **Tokens are hashed at rest.** New credential/token columns storing plaintext → P1.
5. **No secrets in logs.** `console.*` or logger calls interpolating env values or tokens
   → P2.
6. **Untrusted input at trust boundaries is validated** (route params, search params,
   webhook payloads) before use in queries or redirects. → P2.

## Severity rubric

P1 = exploitable or data exposure; P2 = defense-in-depth gap; P3 = hygiene.
