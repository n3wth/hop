# hop

hop is a points-vs-cash flight optimizer and travel companion surface.
It compares cash fares and award options, computes cents-per-point (cpp), and recommends whether to use points, transfer, or pay cash.

## What This Repo Is

- Single Next.js app at the repo root (App Router + RSC)
- Production target: Vercel
- Main product surfaces: home, search, deals, concierge, account, and MCP endpoints

This codebase runs on Next.js 16.2.9 + React 19, with behavior that differs from older Next.js versions.

## Stack

- Next.js 16.2.9 (App Router) + React 19
- TypeScript (strict)
- Tailwind CSS v4
- Vitest

## Run Locally

1. Install dependencies.
2. Start the dev server.

```bash
npm install
npm run dev
```

App URL: `http://localhost:3000`

Useful commands:

```bash
npm run build
npm run lint
npm test
npm run typecheck
npm run check     # lint + typecheck + test — same gate CI runs
```

Mock mode (no upstream keys required):

```bash
npm run dev:mock
```

## Environment Setup

For live integrations, configure environment variables in your shell or `.env.local`
(`cp .env.example .env.local` for an annotated starting point).

Commonly required keys:

- `DUFFEL_API_KEY_TEST` or `DUFFEL_API_KEY_LIVE`
- `SEATS_AERO_API_KEY`
- `AWARDWALLET_API_KEY`
- `AWARDWALLET_USER_ID`
- `AUTH0_*` keys for authenticated surfaces
- Supabase keys used by server helpers

See `lib/env.ts` for access patterns and feature gating.

If you only need UI and deterministic logic work, use `MOCK=1`.

## Project Layout

- `app/`: routes, pages, API handlers
- `components/`: UI components and page building blocks
- `lib/`: domain logic, integrations, and deterministic scoring/ranking utilities
- `utils/`: shared utility helpers
- `docs/`: product, design, and implementation documentation

## Core Architecture

- Verdict engine: `lib/search.ts` assembles options and always resolves with degradation metadata.
- CPP logic: `lib/cpp.ts` computes value tiers used for ranking and UI states.
- Balances resolver: `lib/accounts.ts` merges manual and AwardWallet balances.
- Integrations: `lib/duffel.ts`, `lib/seatsaero.ts`, `lib/awardwallet.ts`, plus transfer and booking helpers.
- Middleware: `middleware.ts` handles Auth0 and Supabase session behavior by route class.

## Key Routes

- `/`: auth-aware home (marketing when signed out, dashboard when signed in)
- `/search`: flight optimizer and verdict flow
- `/deals`: value-oriented redemption discovery
- `/ask`: AI concierge
- `/account`: program and balance management
- `/api/[transport]`: MCP transport endpoints

## Testing Workflow

Run all tests:

```bash
npm test
```

Run one test file (unit tests live in `lib/__tests__/` and `app/**/__tests__/`):

```bash
npx vitest run lib/__tests__/cpp.test.ts
```

Run a single test by name:

```bash
npx vitest run -t "ranks options by cpp"
```

Run type checks:

```bash
npm run typecheck
```

## Documentation

- Docs index: `docs/README.md`
- Content strategy and seed data: `docs/content-plan.md`
- UI copy rules: `docs/design/copy-spec.md`
- Initial implementation plan: `docs/plans/2026-06-28-001-feat-hop-flight-optimizer-plan.md`

## Notes for Contributors

- The verdict engine in `lib/search.ts` is deterministic; rankings and recommendations are computed, not generated.
- Graceful degradation is intentional: upstream failures should produce partial results plus clear degraded notes, never page crashes.
- For framework-specific behavior, consult Next.js docs in `node_modules/next/dist/docs/` before changing route handlers, metadata, middleware/proxy, caching, or request param handling.
- Keep design and copy updates aligned with docs under `docs/design/`.
