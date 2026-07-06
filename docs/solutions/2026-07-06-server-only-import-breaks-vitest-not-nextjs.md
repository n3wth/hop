---
title: "import 'server-only' passes under Next.js and throws under vitest — for the same file"
date: 2026-07-06
tags: [server-only, vitest, next.js, client-boundary, bundler-aliasing, test-config]
files: [vitest.config.ts, lib/sweet-spot-constants.ts, lib/test-stubs/server-only.ts]
status: solved
---

**What happened:**
`lib/sweet-spot-candidates.ts` added `import 'server-only'` — a package that exists purely to
throw if a module carrying it ever gets pulled into client-side code, so a server-only helper
can't accidentally leak into the browser bundle. A client component (`ContentConsole.tsx`, marked
`'use client'`) needed one small constant from that same file
(`CONTENT_CANDIDATES_CREATED_BY`). Next.js's bundler recognizes the `server-only` package
specially and silently aliases it to an empty no-op module inside the server graph
(`node_modules/next/dist/compiled/server-only/empty.js`), so the app itself built and ran fine.
Vitest has no such special case: it resolves `server-only` as a plain npm import under Node, which
makes the package throw unconditionally the moment any test imports that file — including tests
that only wanted the unrelated constant.

**Why it matters:**
`server-only` is designed to fail loudly only when a *bundler's client graph* pulls it in — that's
the whole point of the package. Vitest's module resolution isn't a bundler's client/server graph
distinction at all, so the same import that correctly protects the app in Next.js becomes a false
positive under test, with no way to tell from the error alone that it's a test-environment
artifact rather than a real server/client boundary violation.

**The rule going forward:**
When a module needs `import 'server-only'` but also exports something a client component
legitimately needs (a constant, a type, a pure helper with no I/O):

1. Split the shared, import-free piece into its own module with no `server-only` marker (here,
   `lib/sweet-spot-constants.ts`, mirroring the existing `lib/origin-constants.ts` split) so both
   sides import from a module that carries no server-only guarantee to violate.
2. Separately, alias `server-only` to a local no-op stub in `vitest.config.ts`'s `resolve.alias`
   (`lib/test-stubs/server-only.ts`) so any *other* file that legitimately imports it doesn't
   break test collection just because vitest, unlike Next.js, doesn't special-case the package.

Do both — the module split fixes this specific file's boundary; the vitest alias prevents the
same false positive the next time a different `server-only` module gets imported by a test.

**Evidence:** pull request #231.
