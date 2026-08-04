// No-op stub for the 'server-only' marker package, used ONLY under vitest
// (see vitest.config.ts's resolve.alias). Next's own webpack/turbopack build
// aliases 'server-only' to an equivalent empty module automatically
// (node_modules/next/dist/compiled/server-only/empty.js) so importing it in a
// real server module is always a no-op there; vitest has no such aliasing and
// would otherwise hit the real npm package's index.js, which throws
// unconditionally (it's designed to fail loudly ONLY when a bundler's client
// graph pulls it in — vitest's plain Node resolution isn't that check).
export {}
