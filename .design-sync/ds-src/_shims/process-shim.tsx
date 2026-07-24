// claude.ai/design renders this bundle in a plain browser page — no Node
// `process` global. Several hop lib/* modules read `process.env.NEXT_PUBLIC_*`
// eagerly at module scope (Next.js inlines these at its own build time, so
// it's a no-op there); this shim just needs `process.env.X` to resolve to
// `undefined` instead of throwing. Imported first by every ds-src stub so it
// always evaluates before the real component modules it fronts.
if (typeof globalThis.process === 'undefined') {
  ;(globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process = {
    env: {},
  }
}
export {}
