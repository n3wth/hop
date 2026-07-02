// Plain (non-'use client') home for the origin cookie/localStorage key. Server
// Components (AppShell, page.tsx files) must import it from HERE, not from
// lib/origin-context.tsx — that file has a 'use client' directive, and a
// Server Component importing a named export from a client module gets a
// client-reference stub instead of the real value, silently breaking any
// server-side use (e.g. `cookieStore.get(ORIGIN_STORAGE_KEY)` always misses).
export const ORIGIN_STORAGE_KEY = 'hop_origin'
