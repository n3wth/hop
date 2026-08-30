# 0010. hop's component primitives are synced to a claude.ai/design project

Status: Accepted
Date: 2026-07-22

## Context

hop wants to iterate on brand/UI quickly with Claude Design (claude.ai/design) — a design agent
that builds screens from real, compiled React components instead of generic ones, once those
components are uploaded to a design-system project it can read.

hop is **not** a standalone design-system package: no Storybook, no library `dist`/`main`/
`exports` entry — `components/` is the Next.js app's own tree, and much of it is directly coupled
to Next.js Server Components, Better Auth sessions, and Neon-backed data (admin dashboards,
server-action-backed managers, `AppShell` reading `cookies()`). None of that is portable to a
plain browser bundle claude.ai/design can render standalone, and none of it should be — an agent
composing throwaway design explorations has no business touching auth flows or DB-backed admin
tools.

## Decision

**A curated subset of hop's presentational, prop-driven components is synced to a dedicated
"hop Design System" claude.ai/design project** (project id in `.design-sync/config.json`), via
the `/design-sync` skill's package-shape converter running against a **synthesized entry**
(no real `dist`) pointed at `.design-sync/ds-src/` — a staging folder of thin re-export stubs, one
per scoped component, that is the actual scoping mechanism (see `.design-sync/NOTES.md` for why
`componentSrcMap: null` alone can't scope a synth-entry build).

**In scope**: portable UI primitives with no server/DB/auth coupling — `Icon`, `BrandIcon`,
`Logo`, `Button`, `Sheet`, `EmptyState`, `EditorialHeader`, `SectionHead`, `LegalShell(+Skeleton)`,
`DegradedNote`, `CountUp`, `FlyingBunny`, `Sparkline`, `CardAffiliateCTA`, `FarePolicyCard`, and
the `ai-elements/*` chat kit. **Out of scope**: `components/admin/`, `components/auth/`, every
server-action-backed manager, `AppShell`, the `Concierge` orchestrator, non-visual components,
and the `components/landing/*` page sections (heavier async-data compositions — a candidate for a
follow-up scoping conversation, not this one).

Two small compatibility shims make hop's real Next.js code renderable in a plain browser bundle
(claude.ai/design has no Next.js router or build-time env inlining):
- `.design-sync/tsconfig.ds.json` path-overrides `next/link` to a plain `<a href>` shim.
- `.design-sync/ds-src/_shims/process-shim.tsx`, imported first by every stub, so
  `process.env.NEXT_PUBLIC_*` reads some `lib/*` modules do eagerly at module scope (fine under
  Next's own build, which inlines them) resolve to `undefined` instead of crashing the shared
  bundle.

Design tokens and fonts come from a **one-time copy of a real `npm run build`'s compiled CSS**
(`.design-sync/.cache/compiled.css` + `fonts-src/`, gitignored — hop's source `globals.css` is
Tailwind v4 source, not compiled utilities) — re-syncs must regenerate these when tokens/fonts
change (see NOTES.md's re-sync command).

## Consequences

- **Iterating on hop's brand in Claude Design uses hop's real components and tokens**, not
  generic ones — a design explored there maps close to 1:1 onto what engineers can actually ship.
- **Re-syncing is one command** (`node .ds-sync/resync.mjs ...` — see `.design-sync/NOTES.md`),
  but is NOT automatic: it must be re-run by an agent or engineer after a component/token change
  that should show up in Claude Design, and after any `npm run build` whose compiled CSS changed
  meaningfully (tokens, fonts). Nothing pages anyone when the synced copy drifts from `main`.
- **The scope is a living boundary, not a one-time snapshot.** Adding a new presentational
  component to the design system means adding it to `.design-sync/ds-src/` + `componentSrcMap` and
  re-syncing — see `.design-sync/NOTES.md` "Re-sync risks" before doing so, especially for a
  component that touches `next/navigation`, `next/image`, or reads env vars at module scope (the
  same class of fix as the two shims above will likely be needed again).
- **`components/landing/*` staying out of scope** means Claude Design can't yet compose hop's
  actual page-level layouts (hero, destination grid, etc.) — only its primitives. Scoping those in
  is a deliberate future decision (likely needs `cfg.provider`/mock data for their async data
  fetching), not an oversight.
