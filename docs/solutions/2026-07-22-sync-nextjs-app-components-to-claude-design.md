---
title: Sync a Next.js app's own components (no design-system package) to claude.ai/design
date: 2026-07-22
tags: [design-sync, claude-design, esbuild, next-link, process-env, tailwind-v4, next-font, component-library]
files: [.design-sync/, .ds-sync/]
status: solved
---

## Problem

`/design-sync` converts a design-system **package** (a repo with a library `dist`/`main`/
`exports` entry, usually with Storybook) into the format claude.ai/design consumes. hop has
neither — it's a Next.js app, `components/` is its own UI tree, and `package.json` has no
library entry point at all. Running the converter as-is either fails outright or, worse,
silently bundles unwanted things.

## Symptoms

- `[NO_DIST]` on every build — expected, not a failure, once `synthEntry` mode is accepted.
- Pointing `srcDir` at the real `components/` tree pulls in **every** exported PascalCase symbol
  under it (~90+, across admin/auth/server-action-backed managers) with no way to exclude them
  after the fact: `componentSrcMap: {Name: null}` only hides a name from the *discovered
  component list* — it does NOT stop the converter from re-exporting that file into the
  synthesized bundle entry (`comps = srcFiles.filter(...)` in `lib/source-kit.mjs` walks the
  whole `srcDir`, unfiltered by `componentSrcMap`).
- Any component that (transitively) imports `next/link` crashes the **entire shared bundle**
  with `ReferenceError: process is not defined` — not just that component's own preview. Next's
  `next/link` internals (`node_modules/next/dist/client/has-base-path.js` etc.) read
  `process.env.__NEXT_ROUTER_BASEPATH` and friends, which Next's own webpack/Turbopack build
  inlines via `DefinePlugin`; a plain esbuild IIFE has no `process` global at all, and since every
  `<Name>.html` preview loads the SAME `_ds_bundle.js`, one component's crash takes down all of
  them.
- Similarly, any `lib/*` module that reads `process.env.NEXT_PUBLIC_*` **eagerly at module top
  level** (not inside a function) — e.g. building a lookup table via `ref(url)` calls at
  module-init time — throws the same way, for the same reason, the instant that module is
  reachable from the entry graph.
- The app's own `app/globals.css` (Tailwind v4 source: `@theme` blocks + hand-written utilities)
  is **not** the real stylesheet — the actual utility classes (`bg-brand`, `rounded-[...]`, etc.)
  only exist after Tailwind's compiler runs. Pointing `cssEntry` at the source file ships tokens
  but not utilities.
- `next/font/local`'s `@font-face` rules and a Tailwind v4 CSS var like `--font-bricolage` (set
  via `<html className={bricolage.variable}>`) don't exist anywhere in source — they're
  injected/compiled at Next's own build time, so `[FONT_MISSING]`/`[TOKENS_MISSING]` fire on a
  naive sync.

## Solution

1. **Accept synth-entry mode deliberately** (`cfg.shape: "package"`, no `--entry` pointing at a
   real file) and **scope via a curated staging folder**, not `componentSrcMap: null`:
   `.design-sync/ds-src/` holds one thin re-export stub per component actually wanted
   (`export { default as Icon } from '../../components/Icon'`), and `cfg.srcDir` points there.
   Since the synth entry re-exports *every file in `srcDir`*, this staging folder — not
   `componentSrcMap` — is the real scoping mechanism. `componentSrcMap` is then used purely to
   **pin** each name back to its real source file (`{"Icon": "components/Icon.tsx"}`) so JSDoc
   extraction and folder-derived grouping still work off the real file, not the stub.
2. **`next/link` → a path-override shim**, via a sync-only tsconfig (`cfg.tsconfig` points at
   `.design-sync/tsconfig.ds.json`, NOT the repo's real one — the plugin that reads
   `compilerOptions.paths` doesn't follow `extends`, so re-declare `@/*` too): add
   `"next/link": ["./.design-sync/ds-src/_shims/next-link.tsx"]`, a plain `<a href>` wrapper with
   the same prop contract. Verify the fix by grepping the built bundle for `node_modules/next` —
   it should disappear entirely.
3. **Eager `process.env` reads → a global shim, not a per-module fix.** One file
   (`.design-sync/ds-src/_shims/process-shim.tsx`) sets `globalThis.process = globalThis.process
   ?? { env: {} }` if unset. Import it as the **first statement** of every `ds-src` stub. This is
   airtight regardless of the (unordered, filesystem-dependent) order the synthesized entry
   re-exports files in: ES module dependency evaluation is deterministic *within* a single file
   (a module's own first import always evaluates before its later statements, and before its own
   later imports), so the shim always runs before the real component code it fronts, in every
   stub, and the module system memoizes it (runs once regardless of how many stubs import it).
4. **`cssEntry` → a copy of a real production build's compiled CSS**, not the source stylesheet.
   Run `npm run build`, then find the two CSS chunks Turbopack emits under
   `.next/static/chunks/*.css` **by content** (filenames are hash-based and change every build):
   the larger one has the compiled Tailwind utilities + `@theme` tokens (→ `cssEntry`), the
   smaller one has `next/font`'s `@font-face` rules (→ `cfg.extraFonts`, alongside a `media/`
   copy of the referenced `.woff2` files, mirroring `.next/static/`'s own relative directory
   shape so the existing `../media/*.woff2` refs in the copied CSS keep resolving). Prepend to the
   `cssEntry` copy: any remote `@import` the app's `<head>` loads a font from (Fontshare, in
   hop's case — the validator's `[FONT_REMOTE]` softening only recognizes Google
   Fonts/Typekit/Bunny Fonts, so an unlisted host still warns even though it works — that's a
   known, accepted false-positive, not a bug to chase) and `:root{--font-x: 'Real Family Name'}`
   for any CSS var a Tailwind `@theme` block references but next/font injects at runtime via
   `.variable` classes (grep the compiled CSS for `[TOKENS_MISSING]`'s named vars to confirm which
   ones and their real family names before adding).
5. **Scope `guidelinesGlob` explicitly** if the repo's `docs/` folder isn't a dedicated
   design-guides directory — the default glob (`docs/*.md`) will otherwise upload whatever
   operational/business docs live there (ops runbooks, growth hypotheses, autonomy logs) as
   "design guidelines." Point it at the specific real design docs instead
   (`["docs/design/DESIGN-SYSTEM.md", "docs/design/copy-spec.md"]` for hop) and verify the
   resulting `guidelines/` tree in the build output before uploading, not after.

## How this compounds

- **The scoping mechanism (`ds-src/` staging folder) generalizes to any app-not-package repo**:
  point `srcDir` at a folder you control, pin real paths via `componentSrcMap` for enrichment,
  and the "every PascalCase export in scope" default becomes exactly the components you chose,
  by construction — no maintenance-heavy exclude list that silently under- or over-scopes as the
  real `components/` tree grows.
- **The shim pattern (path-override for a framework import, a first-imported global-setup module
  for eager env reads) is reusable for the next Next.js-specific crash** a future re-sync hits
  scoping in a new component (`next/navigation`, `next/image`, `next/dynamic`, another `lib/*`
  module with a module-top-level env read) — same diagnosis (grep the built bundle for the
  crashing reference; check if it's import-time or call-time), same two fixes.
- **The find-the-real-compiled-CSS-by-content trick** (not by filename) survives every future
  hop build, since Turbopack's chunk hashes are guaranteed to change.
- Full config rationale, the exact re-sync command, and known/accepted warnings live in
  `.design-sync/NOTES.md` — read that before touching `.design-sync/config.json` for a re-sync.
- See `docs/decisions/0012-claude-design-component-library-sync.md` for the decision this
  implements (what's in/out of scope, and why).
