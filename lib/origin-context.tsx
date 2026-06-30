'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

// One persistent departure airport (the user's "where from"), shared across every
// surface so recs are anchored to where they actually fly out of. Persisted two
// ways on change: localStorage (client memory) AND a cookie (so the server can
// seed SSR — see AppShell). null means "not set yet".
interface OriginContextValue {
  origin: string | null
  setOrigin: (iata: string | null) => void
}

const OriginContext = createContext<OriginContextValue | null>(null)

// Shared key for both the localStorage entry and the cookie.
export const ORIGIN_STORAGE_KEY = 'hop_origin'

// ~1 year, in seconds — long enough that the origin sticks across sessions.
const ORIGIN_MAX_AGE = 60 * 60 * 24 * 365

// Normalize to a bare 3-letter uppercase IATA, or null for anything else. We
// don't validate against the airport list here (callers may set a code we don't
// bundle); we only guard the shape so a junk value never poisons storage.
function normalizeIata(raw: string | null): string | null {
  if (!raw) return null
  const code = raw.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : null
}

export function OriginProvider({
  initialOrigin = null,
  children,
}: {
  /** Server-seeded origin from the hop_origin cookie (SSR). */
  initialOrigin?: string | null
  children: ReactNode
}) {
  const [origin, setOriginState] = useState<string | null>(() => normalizeIata(initialOrigin))

  const setOrigin = useCallback((iata: string | null) => {
    const next = normalizeIata(iata)
    setOriginState(next)
    if (typeof window === 'undefined') return
    try {
      if (next) {
        window.localStorage.setItem(ORIGIN_STORAGE_KEY, next)
        // Mirror to a cookie so the next SSR pass knows the origin. Lax keeps it
        // on normal top-level navigations without exposing it cross-site.
        document.cookie = `${ORIGIN_STORAGE_KEY}=${next}; path=/; max-age=${ORIGIN_MAX_AGE}; SameSite=Lax`
      } else {
        window.localStorage.removeItem(ORIGIN_STORAGE_KEY)
        document.cookie = `${ORIGIN_STORAGE_KEY}=; path=/; max-age=0; SameSite=Lax`
      }
    } catch {
      // Storage can throw (private mode, blocked cookies) — the in-memory state
      // still works for the session; persistence is best-effort.
    }
  }, [])

  const value = useMemo<OriginContextValue>(() => ({ origin, setOrigin }), [origin, setOrigin])

  return <OriginContext.Provider value={value}>{children}</OriginContext.Provider>
}

// Read the shared origin. Safe outside a provider — returns a null origin and a
// no-op setter so a stray consumer never crashes (the provider wraps the shell,
// so in practice every surface has one).
export function useOrigin(): OriginContextValue {
  const ctx = useContext(OriginContext)
  if (ctx) return ctx
  return { origin: null, setOrigin: () => {} }
}
