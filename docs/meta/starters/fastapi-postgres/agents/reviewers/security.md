# Reviewer: security

Runs on diffs touching: `app/api/**`, `app/core/**` (auth/security/session), settings
modules, anything reading env, Dockerfiles/deploy config.

Findings return as JSON: `{file, line, severity: "P1"|"P2"|"P3", claim, evidence}`.
Every finding faces a skeptic pass before a human sees it — cite the exact line.

## Checks

1. **Every query on user-owned tables carries the authenticated `user_id`** from the
   request's dependency-injected principal — never from a request body or query param.
   → P1
2. **Endpoints check authorization, not just authentication** — the resource must belong
   to the caller; `Depends(get_current_user)` alone is not ownership. → P1
3. **No secrets in code or logs.** Hardcoded keys, tokens in log interpolations,
   secrets in exception messages that reach responses. → P1
4. **Credentials hashed at rest** (passwords via a KDF, API tokens hashed). Plaintext
   columns → P1.
5. **Input validated at trust boundaries** — Pydantic models on request bodies; no raw SQL
   string interpolation (parametrized queries only). → P1 for injection paths, P2 otherwise.
6. **CORS/host config not widened** (`allow_origins=["*"]` with credentials) → P2.
7. **Debug surfaces off in prod paths** (`debug=True`, `/docs` exposure policy per project
   decision) → P2.

## Severity rubric

P1 = exploitable or data exposure; P2 = defense-in-depth gap; P3 = hygiene.
