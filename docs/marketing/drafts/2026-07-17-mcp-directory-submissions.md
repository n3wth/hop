---
title: "MCP directory submissions — Smithery, PulseMCP, mcp.so"
channel: mcp-directories
status: ready-to-paste
---

**Needs**: named per-directory below — none of the three has a submission path this session
could complete unattended (see `docs/marketing/funnel-log.md` 2026-07-17 entry for what was
tried). All three need only the founder (or a future agent session with the right access) to
paste the copy below in, no drafting left to do.

- **Smithery**: `smithery login` (their CLI auth flow), then
  `smithery mcp publish https://hop.flights/api/mcp -n hop-flights/hop` from a machine with that
  session. No public unauthenticated submission path found.
- **PulseMCP**: `pulsemcp.com/servers` — the directory's own submit intake. The `/use-cases/submit`
  page this session found says "no longer accepting new use case submissions"; that may be a
  different intake than the server directory itself. Check `pulsemcp.com/servers` directly for a
  live "Submit a server" form before assuming it's closed.
- **mcp.so**: either the web form at `mcp.so/submit?type=server` (blocked this session by an
  unauthenticated-fetch 403 — likely just needs a real browser) or a GitHub issue on mcp.so's own
  repo (a different repo than `n3wth/hop`, outside this session's GitHub scope).

---

**Server name**: hop

**One-sentence capability description**: Computes whether to burn loyalty points or pay cash for
a flight — deterministic cents-per-point math (never LLM-generated) against a user's real linked
balances, with transfer-partner reachability and sweet-spot lookups.

**Homepage / info page**: https://hop.flights/mcp

**Server (streamable HTTP) URL**: https://hop.flights/api/mcp

**GitHub repository**: https://github.com/n3wth/hop (the MCP transport lives at
`app/api/[transport]/route.ts`; not currently public which docs/repo to link if the directory
wants server-source-only — confirm before submitting if a private-source SaaS-style MCP server is
acceptable to that directory's listing policy)

**Transport**: Streamable HTTP (`/api/mcp`), plus legacy SSE (`/api/sse`)

**Auth**: Optional Bearer `hop_` token — present resolves to the caller's own linked balances;
absent runs stateless with caller-supplied balances. Free tier 25 calls/day/token, Pro 1,000/day.

**Tool count**: 6 — `price_trip`, `verdict`, `sweet_spots`, `transfer_paths`, `compare_programs`,
`best_card_for_program`

**Category / tags**: travel, finance, loyalty-points, flights

**Longer description (for directories that want one)**:

hop is a points-vs-cash flight verdict engine, exposed as both a website and an MCP server. Every
number it returns — cents-per-point, tier, transfer ratio, the pick — comes from deterministic
`lib/*` code, never from an LLM, so an agent calling hop gets the same trustworthy math a human
sees on hop.flights. `price_trip` and `verdict` price a route and return a computed
points-vs-cash call; `sweet_spots` and `transfer_paths` cover reachability and known high-value
redemptions; `compare_programs` ranks named loyalty programs head-to-head; `best_card_for_program`
maps a program to the card that earns it. Optional per-user Bearer tokens let an agent read the
caller's own real balances instead of guessing.
