// POST /api/counterfactual — COUNTERFACTUAL YOU. "What if I had a different
// points portfolio?"
//
// Takes the user's free-text "what if" (or a pre-structured mutation), runs it
// through hop's DETERMINISTIC engine against their REAL balances, and returns the
// structured diff (unlocked trips, improved headroom, dollar value). The LLM only
// ever TRANSLATES the text into a Mutation (parseMutation, itself clamped to known
// programs); every number in the response comes from runCounterfactual — never the
// model. Session-gated + scoped to session.user.sub so it can only ever mirror the
// signed-in user's own portfolio. NEVER 500s: any failure degrades to a typed
// { ok: false } body the client renders calmly.

import { auth0 } from '@/lib/auth0'
import { getUserBalances } from '@/lib/accounts'
import { runCounterfactual, type Mutation } from '@/lib/counterfactual'
import { parseMutation, validateMutation } from '@/lib/counterfactual-parser'

export const runtime = 'nodejs'

interface CounterfactualRequestBody {
  // Free-text "what if" — translated to a Mutation server-side.
  text?: string
  // Or a pre-structured mutation (e.g. from a quick-action chip). Re-validated.
  mutation?: unknown
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) {
    return Response.json({ ok: false, reason: 'Not signed in' }, { status: 401 })
  }

  let body: CounterfactualRequestBody
  try {
    body = (await request.json()) as CounterfactualRequestBody
  } catch {
    body = {}
  }

  // Resolve the mutation: a structured one (re-validated) wins; else translate the
  // free text. parseMutation never throws and returns null when it can't place one.
  let mutation: Mutation | null = null
  if (body.mutation !== undefined) {
    mutation = validateMutation(body.mutation)
  }
  if (!mutation && typeof body.text === 'string') {
    mutation = await parseMutation(body.text)
  }

  if (!mutation) {
    return Response.json({
      ok: false,
      reason:
        "I couldn't read that as a portfolio change. Try \"what if I had 50k more Chase UR\" or \"what if I held Alaska instead of Delta\".",
    })
  }

  // Run the engine against the user's REAL balances. getUserBalances never throws.
  const balances = await getUserBalances(userId)
  const result = runCounterfactual(balances, mutation)

  return Response.json({ ok: true, result })
}
