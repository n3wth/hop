# hop design-sync notes

See also: `docs/decisions/0010-claude-design-component-library-sync.md` (why this exists, what's
in/out of scope) and `docs/solutions/2026-07-22-sync-nextjs-app-components-to-claude-design.md`
(the reusable technical pattern — synth-entry scoping, the `next/link`/`process.env` shims,
finding the real compiled CSS, `guidelinesGlob` scoping).

## Re-syncing (one command)

Whenever a scoped component or a design token changes and should show up in Claude Design:

```bash
# 1. Re-stage the converter scripts (instant; a stale .ds-sync/ runs an old converter)
SKILLDIR=<design-sync skill base dir>  # find via the design-sync skill, or reuse .ds-sync/ if already staged
mkdir -p .ds-sync && cp -r "$SKILLDIR"/package-build.mjs "$SKILLDIR"/package-validate.mjs \
  "$SKILLDIR"/package-capture.mjs "$SKILLDIR"/resync.mjs "$SKILLDIR"/lib "$SKILLDIR"/storybook .ds-sync/
(cd .ds-sync && npm i esbuild ts-morph @types/react playwright >/dev/null)

# 2. If hop's Tailwind classes/tokens/fonts changed, refresh the compiled CSS + fonts copy first:
npm run build
CSS1=$(grep -l 'color-brand' .next/static/chunks/*.css)   # the larger, utilities+tokens chunk
CSS2=$(grep -l '@font-face' .next/static/chunks/*.css)    # the smaller, font-face chunk
{ echo "@import url('https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap');"; \
  echo ":root{--font-bricolage:'Bricolage Grotesque';--font-geist-mono:'Geist Mono';}"; \
  cat "$CSS1"; } > .design-sync/.cache/compiled.css
mkdir -p .design-sync/.cache/fonts-src/chunks .design-sync/.cache/fonts-src/media
cp "$CSS2" .design-sync/.cache/fonts-src/chunks/fonts.css
grep -oE '\.\./media/[A-Za-z0-9._-]+\.woff2' .design-sync/.cache/fonts-src/chunks/fonts.css \
  | sed 's#\.\./media/##' | sort -u | while read -r f; do cp ".next/static/media/$f" ".design-sync/.cache/fonts-src/media/$f"; done

# 3. Fetch the project's current verification anchor, then run the driver
#    (projectId is in .design-sync/config.json)
# DesignSync(get_file, path: "_ds_sync.json") -> save to .design-sync/.cache/remote-sync.json
node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules \
  --entry ./components/index.ts --out ./ds-bundle --remote .design-sync/.cache/remote-sync.json
```

Add the new/changed component to `.design-sync/ds-src/` (a stub re-exporting the real file) +
`componentSrcMap` first if it's a net-new component — see "Scope" below and the docs/solutions
entry for why that staging folder (not `componentSrcMap: null`) is the actual scoping knob.
The driver prints a verdict JSON; grade any `pendingGrade` cells from
`ds-bundle/_screenshots/review/*.png` into `.design-sync/.cache/review/<Name>.grade.json`, then
upload per the base `/design-sync` skill's atomic-path §5 (this project is no longer empty).

## Scope

First-time sync, deliberately scoped to hop's **presentational, prop-driven** primitives —
not the whole `components/` tree. hop is a Next.js app, not a standalone design-system
package: no Storybook, no library `dist`/`main`/`exports`. The converter runs in
**package shape with a synthesized entry** (`[NO_DIST]` is expected on every build).

Included (33 exports across 16 real component files):
`Icon`, `BrandIcon`, `Logo`, `Button` (`components/ui/Button.tsx`), `EmptyState`,
`EditorialHeader`, `SectionHead`, `LegalShell`, `LegalShellSkeleton`, `DegradedNote`,
`CountUp`, `Sheet`, `FlyingBunny`, `Sparkline` (`components/admin/Sparkline.tsx`),
`CardAffiliateCTA`, `FarePolicyCard` (`components/checkout/FarePolicyCard.tsx`), and the
`ai-elements/*` chat kit (`Conversation`/`ConversationContent`/`ConversationScrollButton`,
`Loader`, `Message`/`MessageContent`/`AssistantByline`,
`PromptInput`/`PromptInputTextarea`/`PromptInputSubmit`, `Response`,
`Suggestions`/`Suggestion`, `Tool`/`ToolHeader`/`ToolContent`/`ToolActivity`).

Excluded (data/server/auth-coupled, not portable to a standalone bundle): everything in
`components/admin/` except `Sparkline`, everything in `components/auth/`, every
server-action-backed manager (AirlineStatusManager, ProgramsManager, StandingOrders,
GmailHistory, MemoryKnows, DeleteAccount, WatchThisRoute, McpAccess,
`checkout/CheckoutForm`, `concierge/A2UIBlock`), `AppShell` (reads `cookies()`),
`Concierge` (orchestrator, not a display component), non-visual components
(PostHogBoot, SearchTelemetry, ScrollToTop, StructuredData), `ProgramPicker`, and the
`components/landing/*` page sections (heavier data-fetching compositions — worth a
follow-up sync if the design agent needs hop's actual page-level layouts).

## Non-default config choices (and why)

- **`srcDir: .design-sync/ds-src`** — a curated staging folder of one re-export stub per
  scoped component, NOT `components/` directly. The converter's synth-entry mode
  re-exports *every* file under `srcDir`, so pointing it at the real `components/` tree
  would have pulled in all ~90 exports there (admin/auth/server-action components) with
  no way to exclude them after the fact (`componentSrcMap: null` only hides a name from
  the *discovered component list*, it does not stop the file from being bundled into the
  entry). The staging folder is the actual scoping mechanism.
- **`componentSrcMap`** pins every scoped name to its REAL file under `components/` (not
  the stub) — this is what gives correct JSDoc extraction and folder-derived grouping
  (`admin`, `checkout`, `ai-elements`; everything else groups `general` since it lives
  directly in `components/`).
- **`.design-sync/tsconfig.ds.json`** — a synced-only tsconfig (not the repo's real one)
  adding ONE path override: `"next/link": ["./.design-sync/ds-src/_shims/next-link.tsx"]`.
  `Button` and `EmptyState` both import `next/link`; the real module reads
  `process.env.__NEXT_ROUTER_BASEPATH` (and similar) at its own module scope, which is
  fine inside Next's own webpack/Turbopack build (these get statically inlined) but
  throws `ReferenceError: process is not defined` in a plain browser bundle — and because
  every preview shares ONE `_ds_bundle.js`, that crash took down all 33 components, not
  just the two that use Link. The shim (`_shims/next-link.tsx`) is a plain `<a href>`
  wrapper with the same `href`/children contract — faithful enough for a design-system
  preview, since claude.ai/design never actually navigates anywhere.
- **`_shims/process-shim.tsx`**, imported first by every `ds-src` stub — `lib/card-affiliates.ts`
  (used by `CardAffiliateCTA`) builds its `CARD_TABLE` at MODULE TOP LEVEL by calling
  `ref(url)` for every card, which reads `process.env.NEXT_PUBLIC_CJ_AFFILIATE_TAG`
  eagerly (again: fine under Next's own build, not fine in a plain esbuild IIFE with no
  `process` global). The shim just sets `globalThis.process = { env: {} }` if it isn't
  already defined, so any `process.env.X` resolves to `undefined` instead of throwing.
  Guaranteed to run before the real component code in every stub because ES module
  dependency evaluation order is deterministic per file (the shim import is the first
  statement, has no dependencies of its own, and module evaluation is memoized).
- **`cssEntry: .design-sync/.cache/compiled.css`** — NOT `app/globals.css` directly.
  hop is Tailwind v4; the source `globals.css` only has hand-written CSS (`@theme`
  tokens, `.hop-skeleton` etc.) — the actual utility classes (`bg-brand`, `rounded-[...]`,
  etc.) only exist after Tailwind's own compiler runs. `cssEntry` points at a COPY of the
  real compiled stylesheet pulled from a production `npm run build`
  (`.next/static/chunks/<hash>.css` — the larger of the two CSS chunks Turbopack emits).
  Also has two small additions prepended: the Fontshare remote `@import` for General
  Sans (see below), and `:root{--font-bricolage:...;--font-geist-mono:...}` (see below).
- **`extraFonts: [.design-sync/.cache/fonts-src/chunks/fonts.css]`** — a copy of the
  OTHER (smaller) compiled CSS chunk, which is where Next's `next/font/local` puts
  `@font-face` rules (Bricolage Grotesque, Fraunces italic, Geist Mono), plus a
  `media/` sibling folder with the actual referenced `.woff2` files copied over
  (original relative `../media/*.woff2` refs preserved by mirroring the same directory
  shape as `.next/static/`).

## Known/accepted warnings (do not re-chase on future syncs)

- **`[FONT_MISSING] "General Sans", "JetBrains Mono"`** — General Sans loads via a
  REMOTE `@import url('https://api.fontshare.com/...')` (see `app/layout.tsx`, Fontshare
  isn't on Google/next-font). The `@import` genuinely IS present in the shipped CSS and
  will actually load in a real browser — the validator's `[FONT_REMOTE]` softening only
  recognizes Google Fonts / Typekit / Bunny Fonts hosts, not Fontshare, so this
  legitimately-fine case prints as a warning instead of the informational
  `[FONT_REMOTE]` line. "JetBrains Mono" is a fourth-choice fallback deep in the
  `--font-mono` stack (`var(--font-geist-mono), "Geist Mono", ui-monospace, "JetBrains
  Mono", monospace`) — Geist Mono (shipped) always wins in practice; JetBrains Mono is
  never actually rendered.
- **`[RENDER_THIN] Loader`, `[RENDER_THIN] FlyingBunny`** — both are authored, both
  screenshot correctly (confirmed visually via the contact sheets — the spinner icon and
  the bunny mark both render fine). The thin-content heuristic (checks for meaningful
  text) false-positives on purely graphical/icon components with no text content.
- **`Sheet`'s validate screenshot is scrim-dominant** — `cfg.overrides.Sheet` sets
  `cardMode: "single"` + a short `viewport` so the in-app Design System pane shows the
  panel at a sensible size; the individual `_screenshots/general__Sheet.png` from
  `package-validate.mjs` is still taken at the default 1200×800 full-page viewport
  regardless of the override (the override affects the app's card rendering, not this
  diagnostic screenshot), so it looks mostly like a gray scrim with the panel docked at
  the bottom — that's genuinely correct bottom-sheet behavior (dimmed backdrop + docked
  panel), not a bug.
- **`--sdm-tbg`, `--tw` in `[TOKENS_MISSING]`'s initial run** (resolved once
  `--font-bricolage`/`--font-geist-mono` were added; these two were never actionable
  and stayed under threshold): `--sdm-tbg` is Streamdown's own internal table-background
  var (only used by `Response`'s markdown tables — cosmetic, falls back to transparent);
  `--tw` only appears inside a Tailwind `@supports (...)` feature-detection query and is
  never meant to resolve to a real value.

- **`guidelinesGlob` is explicitly set** to `["docs/design/DESIGN-SYSTEM.md",
  "docs/design/copy-spec.md"]` — the default glob (`docs/*.md`) would otherwise sweep up
  hop's top-level OPERATIONAL docs (`ops-runbook.md`, `autonomy-log.md`,
  `growth-hypothesis.md`, `cloud-env.md`, `content-plan.md`, etc. — `docs/` at repo root
  is hop's general project-docs folder per `CLAUDE.md`, not a design-guides folder) into
  the uploaded `guidelines/`, leaking internal business/ops content into the design
  system project. Caught before the first upload; if hop adds more real design docs
  under `docs/design/`, add them here explicitly rather than widening the glob.

## Re-sync risks

- **`.design-sync/.cache/compiled.css` and `.cache/fonts-src/` are hand-copied from a
  ONE-TIME `npm run build`, not regenerated automatically.** If hop's Tailwind classes,
  design tokens, or fonts change, a re-sync needs a fresh
  `npm run build` and a re-copy of `.next/static/chunks/<hash>.css` (the larger chunk →
  `compiled.css`, prepend the Fontshare import + the two font-family root vars again)
  and `.next/static/chunks/<hash>.css` (the smaller, font-face-bearing chunk →
  `fonts-src/chunks/fonts.css` + its referenced `media/*.woff2` files). The chunk
  filenames are content-hashed and change every build — find them by content
  (`grep -l color-brand` / `grep -l @font-face` under `.next/static/chunks/`), not by
  name.
- **The `next/link` and `process` shims are scoped to what THIS sync's component set
  actually needs.** If a future re-sync scopes in a component that imports something
  else Next-specific (`next/navigation`, `next/image`, `next/dynamic`, etc.) or reads
  `process.env.*` at module top level, expect the same class of crash and the same class
  of fix: a `tsconfig.ds.json` path override for framework imports, the process-shim
  pattern for eager env reads.
- **The `components/landing/*` page sections were scoped OUT** of this sync (heavier,
  async-data-fetching page compositions) — if a future ask wants hop's actual page-level
  layouts (not just primitives) in the design system, that's a new scoping conversation
  and likely needs `cfg.provider` or per-component mock data, not just more
  `componentSrcMap` entries.
