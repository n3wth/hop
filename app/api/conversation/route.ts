// GET / DELETE /api/conversation — the SIGNED-IN user's persisted concierge
// thread. GET hydrates the conversation on a fresh page load so /ask resumes
// where the traveler left off; DELETE is the quiet "start over" (clears the
// stored thread). Both are session-gated and scoped to session.user.sub, so a
// user can only ever read or clear their OWN thread. Never throws to the page:
// helpers degrade to empty, and we always answer 200 with a clean shape.
//
// This complements the persistence already written by /api/concierge's
// onFinish — we don't re-persist here, we only read/clear.

import { auth0 } from '@/lib/auth0'
import { getConversation, clearConversation, type ConversationMessage } from '@/lib/conversations'

export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  let userId: string | undefined
  try {
    const session = await auth0.getSession()
    userId = session?.user?.sub
  } catch {
    userId = undefined
  }
  // Signed-out users have no server thread (session-only memory lives in the
  // client). Answer with an empty thread rather than a 401 so the client can
  // treat both states uniformly.
  if (!userId) {
    return Response.json({ ok: true, signedIn: false, messages: [] as ConversationMessage[] })
  }
  const messages = await getConversation(userId)
  return Response.json({ ok: true, signedIn: true, messages })
}

export async function DELETE(): Promise<Response> {
  let userId: string | undefined
  try {
    const session = await auth0.getSession()
    userId = session?.user?.sub
  } catch {
    userId = undefined
  }
  if (!userId) {
    return Response.json({ ok: true, signedIn: false })
  }
  const ok = await clearConversation(userId)
  return Response.json({ ok, signedIn: true })
}
