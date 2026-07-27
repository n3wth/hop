// Only allow same-origin, app-relative returnTo paths. Reject absolute URLs,
// protocol-relative ('//evil.com'), and backslash tricks to prevent open
// redirects. Shared by /login and /account (the R1.1 activation bridge) so the
// two surfaces can never drift apart on what counts as a safe destination.

export function safeReturnTo(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (!v) return null
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || v.includes('\\')) return null
  return v
}

// The /login href for an auth-gated page, carrying the FULL url (path + query)
// the visitor was trying to reach. The query params often ARE the context —
// dropping them is how "book with cash → log in → nothing to book" happens:
// /book's offer/route live entirely in its query string.
export function loginHrefFor(
  path: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) {
    const s = Array.isArray(v) ? v[0] : v
    if (s) p.set(k, s)
  }
  const qs = p.toString()
  return `/login?returnTo=${encodeURIComponent(qs ? `${path}?${qs}` : path)}`
}

// Human label for a returnTo that points at a search ("SFO → NRT"), or null
// when the path isn't a search / has no route. Display-only — never used for
// navigation, so a weird query string just falls back to the generic label.
export function returnToRouteLabel(returnTo: string): string | null {
  try {
    const query = returnTo.split('?')[1]
    if (!query) return null
    const q = new URLSearchParams(query)
    const from = (q.get('from') ?? '').trim().toUpperCase()
    const to = (q.get('to') ?? '').trim().toUpperCase()
    if (/^[A-Z]{3}$/.test(from) && /^[A-Z]{3}$/.test(to)) return `${from} → ${to}`
  } catch {
    // Fall through to the generic label.
  }
  return null
}
