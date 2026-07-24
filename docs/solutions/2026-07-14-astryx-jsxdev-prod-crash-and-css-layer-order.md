---
title: Third-party UI kit's dev-only jsxDEV import crashes Next prod builds; @layer name omission flips cascade order
date: 2026-07-14
tags: [nextjs16, react19, patch-package, jsx-runtime, turbopack, tailwind-v4, css-layers, astryx, build-crash]
files: [patches/next+16.2.9.patch, patches/react+19.2.4.patch, app/globals.css, components/AstryxProviders.tsx]
status: solved
---

## What happened

PR #291 added `@astryxdesign/core` (Meta's design system, "Astryx") to port a few accessibility-
critical UI primitives (Dialog, DropdownMenu, Toast, EmptyState). The moment any Astryx component
was imported, `next build` crashed while statically prerendering **every** page — not just pages
that used Astryx — with `(0, jsxDEV) is not a function`.

Separately, a one-line typo while wiring up Astryx's base stylesheet made every Astryx component
render with the wrong colors sitewide (not just wrong radii — full background/text color
mismatches), because of how Tailwind v4's CSS `@layer` ordering actually works.

## Why it happened

**The jsxDEV crash.** JSX compiles to different runtime calls depending on build mode: development
builds emit calls to `jsxDEV` (from `react/jsx-dev-runtime`, which carries extra debug metadata),
production builds emit `jsx`/`jsxs` (from `react/jsx-runtime`) instead. React 19's *production*
`jsx-dev-runtime` module deliberately exports `jsxDEV = void 0` — nothing is supposed to call it in
prod. Astryx 0.1.5's own compiled `dist/` output hardcoded a production-path import of `jsxDEV`
anyway (a bug in Astryx, not in this repo), so the moment Next tried to statically render a page
through Astryx's code, it called `undefined()` and crashed.

The obvious fix — alias the broken import to the real implementation via
`next.config.ts`'s `turbopack.resolveAlias` (the documented mechanism for this class of problem;
webpack's equivalent is `NormalModuleReplacementPlugin`) — **didn't work in Next 16.2.9**. It
reliably rewrites the *browser* bundle but never reaches Turbopack's server/prerender compilation
graph. Root cause, one layer further down: Next's SSR runtime doesn't even resolve
`node_modules/react` for this at request time — it vendors a whole copy of React inline into one
precompiled bundle (`next/dist/compiled/next-server/app-page-turbo.runtime.prod.js`), and that
vendored copy has the same `jsxDEV = void 0` baked in as literal minified text. Aliasing
`node_modules/react` changes nothing because the broken code isn't reading from
`node_modules/react` at all.

**The CSS layer bug.** Tailwind v4's `@import "tailwindcss"` declares its own internal `@layer`
order. CSS resolves layer priority by *where a layer name first appears anywhere in the loaded
stylesheets* — not by selector specificity, and specificity is ignored entirely once layers are in
play. An early version of the Astryx wiring pre-declared the layer order but dropped one layer's
name (`reset`) from that pre-declaration line. That sent the whole `reset` layer to the *end* of
the global order instead of the front, so Astryx's `reset.css` — even its zero-specificity
`:where()` rules — started beating this app's own component-level color overrides on every
Astryx-themed element, sitewide.

## The fix

- **jsxDEV**: patch both affected files with `patch-package`, applied automatically on every
  `npm install` via a `postinstall` script — `patches/react+19.2.4.patch` (top-level `react`
  package) and `patches/next+16.2.9.patch` (the vendored `next-server` runtime bundle). Both make
  `jsxDEV` delegate to the real production `jsx`/`jsxs` implementation instead of being `undefined`.
  See each patch file's own header comment for the exact lines changed.
- **CSS layer order**: explicitly name every layer, including `reset`, in the pre-declaration line
  in `app/globals.css`, so it lands first in cascade order as intended. Verified with a screenshot
  pass across a handful of hop's own (non-Astryx) pages to confirm no regression.

## The rule

- When a third-party package crashes only in a **production** build (not dev), suspect a
  dev-vs-prod runtime mismatch (`jsx-dev-runtime` vs `jsx-runtime` is the classic case for React
  19) before suspecting your own config — and check whether the framework vendors a precompiled
  copy of the dependency you're trying to alias (Next does, for its SSR runtime); a config-level
  alias can't reach code the framework already inlined at build time. `patch-package` + a
  `postinstall` hook is the right tool once you've confirmed that: it fixes the bug at its actual
  location instead of routing around it, and reapplies automatically on every future install so
  the fix can't silently disappear on a dependency bump.
- When pre-declaring a Tailwind v4 `@layer` order for a third-party stylesheet, list every layer
  name explicitly. A dropped name doesn't error — it just silently reorders that whole layer to
  the back of the cascade, and because layer priority beats selector specificity unconditionally,
  the bug shows up as "my styles are being overridden by something with lower specificity," which
  is a confusing symptom to debug from the CSS alone.
