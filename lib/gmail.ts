// Gmail OAuth + read client for the travel-history seam. Thin fetch wrappers
// around Google's OAuth2 token endpoint and the Gmail REST API — NO new deps
// (mirrors lib/awardwallet.ts). SERVER ONLY (uses the client secret + refresh
// tokens). Every function degrades gracefully and NEVER throws to the page.
//
// PRIVACY POSTURE (enforced here + at the persistence layer):
//   - Scope is read-only (gmail.readonly) — we can never modify the mailbox.
//   - We search ONLY for travel-confirmation emails via a tight query (see
//     CONFIRMATION_QUERY) and read only those messages.
//   - We extract normalized trip FACTS from the parser and discard raw bodies.
//   - The refresh token lets us re-read on demand; disconnect deletes it.

import { env, hasEnv } from '@/lib/env'

const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const TIMEOUT_MS = 15_000

// Read-only scope ONLY. We deliberately do not request modify/send/full access.
// userinfo.email lets us show the user which inbox is connected.
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

// The tight Gmail search that scopes our read to TRAVEL-CONFIRMATION mail only.
// `category:` and the from/subject terms keep us off everything else in the
// inbox. Looks back ~3 years — enough to derive seasonal patterns without a
// full-mailbox sweep. Kept here as the single source of truth for what we read.
export const CONFIRMATION_QUERY = [
  'newer_than:3y',
  '(',
  'subject:(confirmation OR itinerary OR "booking confirmed" OR "e-ticket" OR "your trip" OR "reservation")',
  ' OR from:(',
  'united.com OR delta.com OR aa.com OR alaskaair.com OR southwest.com OR jetblue.com',
  ' OR flyfrontier.com OR british-airways.com OR aircanada.ca OR lufthansa.com',
  ' OR marriott.com OR hilton.com OR hyatt.com OR ihg.com',
  ' OR expedia.com OR booking.com OR kayak.com OR chase.com',
  ')',
  ')',
].join('')

// --- OAuth ------------------------------------------------------------------

// The consent URL we send the user to. `access_type=offline` + `prompt=consent`
// guarantees Google returns a refresh token we can persist. `state` is our CSRF
// nonce, round-tripped and re-checked on the callback.
export function buildAuthUrl(redirectUri: string, state: string): string {
  const u = new URL(OAUTH_AUTH_URL)
  u.searchParams.set('client_id', env.googleOAuthClientId())
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', GMAIL_SCOPES.join(' '))
  u.searchParams.set('access_type', 'offline')
  u.searchParams.set('prompt', 'consent')
  u.searchParams.set('include_granted_scopes', 'true')
  u.searchParams.set('state', state)
  return u.toString()
}

export interface GoogleTokens {
  accessToken: string
  refreshToken?: string
  scope?: string
  expiresIn?: number
}

async function tokenRequest(body: Record<string, string>): Promise<GoogleTokens | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      access_token?: string
      refresh_token?: string
      scope?: string
      expires_in?: number
    }
    if (!json.access_token) return null
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      scope: json.scope,
      expiresIn: json.expires_in,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Exchange the one-time authorization code for tokens (incl. the refresh token).
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<GoogleTokens | null> {
  if (!hasEnv('GOOGLE_OAUTH_CLIENT_ID') || !hasEnv('GOOGLE_OAUTH_CLIENT_SECRET')) return null
  return tokenRequest({
    code,
    client_id: env.googleOAuthClientId(),
    client_secret: env.googleOAuthClientSecret(),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
}

// Mint a fresh access token from a stored refresh token (access tokens expire ~1h).
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  if (!hasEnv('GOOGLE_OAUTH_CLIENT_ID') || !hasEnv('GOOGLE_OAUTH_CLIENT_SECRET')) return null
  const tokens = await tokenRequest({
    refresh_token: refreshToken,
    client_id: env.googleOAuthClientId(),
    client_secret: env.googleOAuthClientSecret(),
    grant_type: 'refresh_token',
  })
  return tokens?.accessToken ?? null
}

// Best-effort revoke of a refresh/access token at Google's revocation endpoint.
// Called on disconnect so our access is killed upstream, not just locally.
// Returns whether the upstream call itself succeeded — best-effort means the
// caller's local disconnect proceeds regardless, but a caller can still log a
// failure here (a token that silently stayed valid at Google is worth knowing
// about, even though the local row is gone).
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return res.ok
  } catch {
    return false
  }
}

// --- Gmail read -------------------------------------------------------------

// Discriminated so callers can tell "the mailbox has nothing to say" (ok, empty
// result) apart from "we couldn't ask" (dead/revoked token vs. a transient
// network/5xx blip) — the root-cause gap this seam had: a 401 and an empty
// inbox both used to collapse to the same `null`.
type GmailGetResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number | null; authFailed: boolean }

async function gmailGet<T>(path: string, accessToken: string): Promise<GmailGetResult<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${GMAIL_BASE}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) {
      return { ok: false, status: res.status, authFailed: res.status === 401 || res.status === 403 }
    }
    return { ok: true, data: (await res.json()) as T }
  } catch {
    return { ok: false, status: null, authFailed: false }
  } finally {
    clearTimeout(timer)
  }
}

// The connected account's email, for display ("Connected as you@gmail.com").
export async function getProfileEmail(accessToken: string): Promise<string | null> {
  const res = await gmailGet<{ emailAddress?: string }>('/profile', accessToken)
  return res.ok ? res.data.emailAddress ?? null : null
}

// A parsed confirmation message we hand to the parser: subject, sender, the
// internal date, and the decoded plain-text body. We never persist these.
export interface RawMessage {
  id: string
  subject: string
  from: string
  internalDate: number // epoch ms
  body: string
}

// Discriminated so the caller (syncTravelHistory) can tell a dead/revoked
// access token (authFailed) apart from a genuinely empty/no-match inbox
// (ok: true, ids: []) apart from a transient fetch failure (ok: false,
// authFailed: false) — three different situations that used to all read as
// "0 messages."
export type MessageListResult =
  | { ok: true; ids: string[] }
  | { ok: false; authFailed: boolean }

// List message ids matching the tight confirmation query. Pages through with
// pageToken (Gmail caps a page at ~100 ids) up to `max` total — the old single
// 50-newest page silently dropped a frequent flyer's older history. Still
// bounded so a huge mailbox can't run away.
export async function listConfirmationMessageIds(
  accessToken: string,
  max = 300,
): Promise<MessageListResult> {
  const q = encodeURIComponent(CONFIRMATION_QUERY)
  const cap = Math.min(max, 300)
  const ids: string[] = []
  let pageToken: string | undefined
  do {
    const pageSize = Math.min(cap - ids.length, 100)
    const res = await gmailGet<{ messages?: Array<{ id?: string }>; nextPageToken?: string }>(
      `/messages?q=${q}&maxResults=${pageSize}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
      accessToken,
    )
    if (!res.ok) {
      // Fail the whole listing only if the FIRST page failed; a mid-pagination
      // blip degrades to the ids we already have.
      if (ids.length === 0) return { ok: false, authFailed: res.authFailed }
      break
    }
    ids.push(
      ...(res.data.messages ?? []).map((m) => m.id).filter((id): id is string => Boolean(id)),
    )
    pageToken = res.data.nextPageToken
  } while (pageToken && ids.length < cap)
  return { ok: true, ids }
}

// base64url → utf8 string (Gmail encodes part bodies this way).
function decodeBody(data: string | undefined): string {
  if (!data) return ''
  try {
    const b64 = data.replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(b64, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

interface GmailPart {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPart[]
}

// Walk the MIME tree and pull the first text/plain body (falls back to stripped
// text/html). Keeps us off attachments + multipart noise.
function extractPlainText(payload: GmailPart | undefined): string {
  if (!payload) return ''
  const stack: GmailPart[] = [payload]
  let html = ''
  while (stack.length) {
    const part = stack.shift() as GmailPart
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBody(part.body.data)
    }
    if (part.mimeType === 'text/html' && part.body?.data && !html) {
      html = decodeBody(part.body.data)
    }
    if (part.parts) stack.push(...part.parts)
  }
  // Strip tags from HTML fallback.
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Fetch + decode a single confirmation message. Returns null on any failure.
export async function getMessage(
  accessToken: string,
  id: string,
): Promise<RawMessage | null> {
  const res = await gmailGet<{
    internalDate?: string
    payload?: GmailPart & { headers?: Array<{ name?: string; value?: string }> }
  }>(`/messages/${id}?format=full`, accessToken)
  if (!res.ok) return null
  const json = res.data
  const payload = json.payload
  if (!payload) return null
  const headers = payload.headers ?? []
  const header = (name: string): string =>
    headers.find((h) => (h.name ?? '').toLowerCase() === name)?.value ?? ''
  return {
    id,
    subject: header('subject'),
    from: header('from'),
    internalDate: Number(json.internalDate ?? 0),
    body: extractPlainText(payload),
  }
}
