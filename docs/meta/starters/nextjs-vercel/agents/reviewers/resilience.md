# Reviewer: resilience

Runs on diffs touching: `lib/**` external clients, DB access, route handlers, server
components.

Findings return as JSON: `{file, line, severity, claim, evidence}`.

## Checks

1. **External clients return typed failure results** (`{ok: false, ...}` or equivalent),
   never throw into a page, route, or agent. A bare `await fetch(...)` whose rejection
   propagates to a server component → P1.
2. **Pages degrade per-section.** One failed upstream should degrade its section, not
   crash the route. A `Promise.all` where one rejection takes down the page → P2
   (use `Promise.allSettled` or per-source try/catch with fallbacks).
3. **DB helpers return fallbacks** (`[]`, `null`, `{ok:false}`) when the DB is
   unreachable; callers must not need try/catch to survive.
4. **New integrations are flag-gated** and no-op cleanly when unconfigured. A seam that
   throws when its env var is absent → P1.
5. **Env access is lazy** — read at call time, not import time, so importing a client never
   throws in tests or mock mode. → P2.
6. **Timeouts exist** on external calls; a fan-out awaiting an unbounded upstream → P2.

## Severity rubric

P1 = a single upstream failure crashes a user-facing surface; P2 = degradation exists but
is coarser than per-section; P3 = hygiene.
