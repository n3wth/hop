// POST /api/dream — the NARRATION layer for THE LEDGER DREAM.
//
// The engine (lib/ledger-dream.ledgerDream) has ALREADY chosen the trip and every
// number — destination, miles, cpp, cash value, and the exact pool→program proof.
// This route only writes the short, second-person, evocative blurb FOR that pick.
// The model narrates; it never invents the economics. If the gateway is missing or
// the stream fails, we degrade to a deterministic templated blurb served through
// the SAME text stream, so the Dream card always fills in. NEVER 500s.
//
// Streaming reuses the concierge pattern: streamText through the AI Gateway,
// pumped to a plain text/plain body the client types out live.

import { streamText, gateway } from 'ai'
import { ledgerDream } from '@/lib/ledger-dream'
import { resolveDreamSession } from '@/lib/dream-server'
import { buildDreamPrompt, templatedBlurb } from '@/lib/dream-narration'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { GATEWAY_MODEL } from '@/lib/ai-gateway'
import { llmTelemetry } from '@/lib/llm-tracing'

export const runtime = 'nodejs'

// A small, steady budget: the card narrates once per render + on "Dream me
// another". Allow a short burst, then a trickle, so a spammed button can't run up
// gateway cost. Keyed by sub when signed in, always by IP.
const DREAM_RATE = { capacity: 6, refillPerSec: 0.2 }

export interface DreamRequest {
  // Which corner of the portfolio to dream ("Dream me another" increments it).
  index?: number
}

// Serve a string as a one-shot text stream (the fallback path), matching the
// streamed body shape the client reads either way.
function textResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

export async function POST(request: Request): Promise<Response> {
  let body: DreamRequest = {}
  try {
    body = (await request.json()) as DreamRequest
  } catch {
    body = {}
  }
  const index = typeof body?.index === 'number' && Number.isFinite(body.index) ? body.index : 0

  // Identity + real balances + home origin (shared resolver; never throws).
  // Signed-in → their merged balances drive the dream; signed-out → empty, so the
  // engine serves the save-toward fallback.
  const { userId, balances } = await resolveDreamSession()

  // Rate limit before any model work. Friendly fallback on limit — never a 429.
  const ip = clientIp(request)
  const keys = userId ? [`dream:sub:${userId}`, `dream:ip:${ip}`] : [`dream:ip:${ip}`]
  for (const k of keys) {
    if (!(await checkRateLimit(k, DREAM_RATE)).ok) {
      // Still serve a real dream — just the templated voice, no model call.
      return textResponse(templatedBlurb(ledgerDream(balances, index)))
    }
  }

  // Let the ENGINE pick + price. This is the same engine the UI uses, so prose
  // and card can never disagree.
  const dream = ledgerDream(balances, index)

  // No gateway key → templated voice, same stream shape.
  if (!process.env.AI_GATEWAY_API_KEY) {
    return textResponse(templatedBlurb(dream))
  }

  try {
    const { system, user } = buildDreamPrompt(dream)
    const result = streamText({
      model: gateway(GATEWAY_MODEL),
      system,
      prompt: user,
      experimental_telemetry: llmTelemetry('dream'),
      onError({ error }) {
        console.error('[dream] stream error', error)
      },
    })

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let any = false
        try {
          for await (const delta of result.textStream) {
            if (delta) {
              any = true
              controller.enqueue(encoder.encode(delta))
            }
          }
        } catch (err) {
          console.error('[dream] pump error', err)
        }
        // If the model produced nothing (error/empty), fall back to the template
        // so the card is never blank.
        if (!any) controller.enqueue(encoder.encode(templatedBlurb(dream)))
        controller.close()
      },
    })

    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.error('[dream] setup failed, serving template', err)
    return textResponse(templatedBlurb(dream))
  }
}
