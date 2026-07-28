---
title: Empty NEXT_PUBLIC_SITE_URL environment variable causes TypeError in Next.js metadataBase prerender
date: 2026-07-25
tags: [nextjs, seo, metadata, environment-variables, build-fix]
files: [lib/seo.ts, app/layout.tsx]
status: solved
---

## Problem

During `next build`, page data collection for static and `_not-found` routes crashed with an unhandled exception:

```
Error: Failed to collect configuration for /_not-found
  [cause]: TypeError: Invalid URL
      at module evaluation (app/layout.tsx:45:17)
      code: 'ERR_INVALID_URL',
      input: ''
```

Line 45 of `app/layout.tsx` instantiates `metadataBase: new URL(SITE_URL)`. `SITE_URL` was previously defined in `lib/seo.ts` as:

```ts
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://hop.flights'
```

When `NEXT_PUBLIC_SITE_URL` is set to an empty string `""` in the environment (e.g. an unpopulated key in `.env.local` or build environments), `"".replace(/\/$/, '')` returns `""`. Because `""` is a non-nullish string, the nullish coalescing operator `??` evaluates to `""` instead of falling back to `'https://hop.flights'`. Passing `""` to `new URL("")` throws `TypeError: ERR_INVALID_URL` at module evaluation time when Next.js collects metadata for static route generation.

## Solution

Updated `lib/seo.ts` to explicitly check that `process.env.NEXT_PUBLIC_SITE_URL` exists and is non-empty after trimming whitespace before attempting to use it:

```ts
export const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim() !== '')
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
    : 'https://hop.flights'
```

This ensures that empty strings, whitespace-only strings, or unconfigured environment variables safely fall back to the default production origin `'https://hop.flights'`.

## Verification

1. `npm run check` passed all 113 test files and 1,356 unit tests.
2. `npm run build` completed static page generation for all 160 routes without `ERR_INVALID_URL` errors.

## Lessons learned

1. **Nullish coalescing (`??`) does not protect against empty strings (`""`)**: Always guard string environment variables against empty values using `.trim() !== ''` or falsy checks (`Boolean(val)`), as empty strings are non-nullish and pass `??` checks.
2. **MetadataBase evaluation happens during module load**: In Next.js App Router, `metadataBase` in root layout is evaluated during SSR/prerender module load for static routes including `_not-found`. An invalid URL at top-level constant definition will fail the build before static routes can render.
