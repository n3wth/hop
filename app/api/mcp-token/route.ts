// GET / POST / DELETE /api/mcp-token — manage the SIGNED-IN user's "Add to
// Claude" tokens. Session-gated and scoped to session.user.sub so a user can
// only see/mint/revoke their OWN tokens.
//   GET    -> list tokens (no secrets; last-four only)
//   POST   -> mint a token; returns the PLAINTEXT exactly once
//   PATCH  -> rename a token by id (body: { id, name }); returns updated info
//   DELETE -> revoke a token by id (?id=…)
// These tokens link a hop user to the MCP server so its tools can load that
// user's real balances. See lib/api-tokens.ts and app/api/[transport]/route.ts.

import { auth0 } from '@/lib/auth0'
import { listTokens, mintToken, renameToken, revokeToken } from '@/lib/api-tokens'

export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) {
    return Response.json({ ok: false, reason: 'Not signed in' }, { status: 401 })
  }
  const tokens = await listTokens(userId)
  return Response.json({ ok: true, tokens })
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) {
    return Response.json({ ok: false, reason: 'Not signed in' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const name =
    body && typeof body === 'object' && typeof (body as Record<string, unknown>).name === 'string'
      ? ((body as Record<string, unknown>).name as string)
      : undefined

  const minted = await mintToken(userId, name)
  if (!minted) {
    return Response.json({ ok: false, reason: 'Could not mint token' }, { status: 500 })
  }
  // The plaintext token is returned ONCE here and never again — the client must
  // surface it for copy immediately.
  return Response.json({ ok: true, token: minted.token, info: minted.info })
}

export async function PATCH(request: Request): Promise<Response> {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) {
    return Response.json({ ok: false, reason: 'Not signed in' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const rec = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const id = typeof rec.id === 'string' ? rec.id : undefined
  const name = typeof rec.name === 'string' ? rec.name : undefined
  if (!id || name === undefined) {
    return Response.json({ ok: false, reason: 'Missing id or name' }, { status: 400 })
  }
  // Scoped to session.user.sub inside renameToken — a user can only rename their
  // OWN tokens; an unknown/foreign id resolves to null and 404s here.
  const info = await renameToken(userId, id, name)
  if (!info) {
    return Response.json({ ok: false, reason: 'Token not found' }, { status: 404 })
  }
  return Response.json({ ok: true, info })
}

export async function DELETE(request: Request): Promise<Response> {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) {
    return Response.json({ ok: false, reason: 'Not signed in' }, { status: 401 })
  }
  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return Response.json({ ok: false, reason: 'Missing token id' }, { status: 400 })
  }
  const revoked = await revokeToken(userId, id)
  return Response.json({ ok: revoked })
}
