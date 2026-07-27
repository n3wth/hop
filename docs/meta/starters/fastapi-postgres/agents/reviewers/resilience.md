# Reviewer: resilience

Runs on diffs touching: `app/services/**`, external clients, DB access, request handlers.

Findings return as JSON: `{file, line, severity, claim, evidence}`.

## Checks

1. **External clients return typed results** (`Ok`/`Err` union or discriminated dataclass),
   never raise into a handler. A bare `httpx` call whose exception propagates to the route
   → P1.
2. **Handlers degrade per-section.** One failed upstream degrades its part of the response,
   not the whole endpoint. `asyncio.gather(...)` without `return_exceptions=True` (or
   per-task handling) where one failure 500s the route → P2.
3. **Timeouts on every external call.** `httpx` without an explicit timeout → P2
   (the default is not a decision).
4. **DB helpers return fallbacks** when the DB is unreachable; callers must not need
   try/except to survive. → P2
5. **New integrations are flag-gated** (settings flag) and no-op cleanly when unconfigured.
   A client that raises at import or first call when its key is absent → P1.
6. **Settings access is lazy** — module import must not require env vars (breaks tests and
   fake-backends mode). → P2
7. **Retries are bounded and idempotent-only.** Retrying a non-idempotent POST → P1.

## Severity rubric

P1 = a single upstream failure crashes a user-facing surface or corrupts state;
P2 = degradation exists but coarser than per-section; P3 = hygiene.
