# Reviewer: framework-version

Runs on diffs touching: route handlers, `middleware.*`/`proxy.*`, metadata exports, server
actions, caching/revalidation, `params`/`searchParams` usage, `next.config.*`.

Purpose: the installed Next.js version's behavior differs from model training data. Verify
the diff against the **installed docs** (`node_modules/next/dist/docs/`), not memory.

## Checks

1. For each framework API the diff uses, open the corresponding installed doc and confirm
   the signature and semantics match. Cite the doc file in the finding's evidence. A usage
   that matches training-data Next but not the installed docs → P1.
2. Async request APIs: `params`, `searchParams`, `cookies()`, `headers()` — confirm the
   sync/async shape against the installed version. → P1 if wrong.
3. Caching defaults: do not assume fetch caching or route segment behavior from memory;
   check the installed caching guide before approving `revalidate`/`cache` options. → P2.
4. Deprecation notices in the installed docs that the diff's pattern triggers → P2, with
   the replacement named.
5. Config options in `next.config.*` verified to exist in the installed version. → P2.

## Severity rubric

P1 = wrong behavior at runtime; P2 = deprecated or default-mismatch; P3 = style drift from
the installed docs' recommendations.
