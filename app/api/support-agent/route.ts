import { auth0 } from '@/lib/auth0'
import { isSupportAgentEnabled } from '@/lib/env'
import { clientIp, checkRateLimit } from '@/lib/rate-limit'
import { getAccountSnapshot, snapshotSummary, buildSupportSystem, type AccountSnapshot } from '@/lib/support-context'
import { buildSupportTools } from '@/lib/support-agent-tools'
import { fallbackSupportAnswer } from '@/lib/support-kb'
import { walletValue } from '@/lib/valuations'
import { GATEWAY_MODEL } from '@/lib/ai-gateway'
import { streamText, stepCountIs, gateway } from 'ai'
import {
  encodeToolFrame,
  sanitizeProse,
  type ToolActivityFrame,
} from '@/app/api/concierge/route'
import type { Balance } from '@/lib/types'

export const runtime = 'nodejs'

const RATE_LIMIT = { capacity: 6, refillPerSec: 0.15 }

interface RequestMessage {
  role: string
  content: unknown
}

function supportToolDetail(toolName: string, input: Record<string, unknown> | undefined): string {
  switch (toolName) {
    case 'get_account_snapshot':
      return 'Checked your account'
    case 'explain_verdict': {
      const from = typeof input?.from === 'string' ? input.from : undefined
      const to = typeof input?.to === 'string' ? input.to : undefined
      return from && to
        ? `Re-ran ${from.toUpperCase()} → ${to.toUpperCase()}`
        : to
        ? `Re-ran flight to ${to.toUpperCase()}`
        : 'Re-ran flight search'
    }
    case 'search_help':
      return 'Searched help center'
    case 'transfer_paths': {
      const prog = typeof input?.program === 'string' ? input.program : 'partner'
      return `Checked ${prog} transfer ratios`
    }
    case 'escalate_to_human':
      return 'Escalated to human support'
    default:
      return 'Consulted tool'
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isSupportAgentEnabled()) {
    return new Response(
      'hop support agent is unconfigured — see /support for FAQ or email support@hop.flights.',
      { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return new Response('I didn’t catch that — ask a question about your account or hop.', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  const rawMessages = Array.isArray(body?.messages) ? (body.messages as RequestMessage[]) : []
  const question = typeof body?.question === 'string' ? body.question : ''

  let userId: string | undefined
  let sessionEmail: string | undefined
  try {
    const session = await auth0.getSession()
    userId = session?.user?.sub
    sessionEmail = session?.user?.email
  } catch {
    userId = undefined
    sessionEmail = undefined
  }

  const ip = clientIp(request)
  const limitKeys = userId ? [`sub:${userId}`, `ip:${ip}`] : [`ip:${ip}`]
  for (const k of limitKeys) {
    if (!(await checkRateLimit(k, RATE_LIMIT)).ok) {
      return new Response(
        "You're moving fast — give hop a few seconds to catch its breath, then ask again.",
        { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } }
      )
    }
  }

  const lastUserMsg = rawMessages
    .slice()
    .reverse()
    .find((m) => m.role === 'user')
  const queryStr = question.trim() || (lastUserMsg ? String(lastUserMsg.content) : '')

  const conversationKey =
    typeof body?.conversationKey === 'string'
      ? body.conversationKey
      : request.headers.get('x-conversation-key') || undefined

  let snapshot: AccountSnapshot
  let balances: Balance[] = []
  let walletDollars: number | undefined
  try {
    snapshot = await getAccountSnapshot(userId)
    balances = snapshot.signedIn ? snapshot.balances : []
    walletDollars = snapshot.signedIn && balances.length > 0 ? walletValue(balances) : undefined
  } catch {
    snapshot = {
      signedIn: Boolean(userId),
      balances: [],
      tier: 'free',
      standingOrders: [],
      alerts: [],
      escalations: [],
      prefs: {},
      hasAwardWallet: false,
    }
    balances = []
    walletDollars = undefined
  }

  const snapshotBlock = snapshotSummary(snapshot, walletDollars)
  const system = buildSupportSystem(snapshotBlock, Boolean(snapshot.signedIn))

  const tools = buildSupportTools({
    userId,
    sessionEmail,
    balances,
    walletDollars,
    homeAirport: snapshot.prefs?.homeAirport,
    conversationKey,
  })

  let formattedMessages: { role: 'user' | 'assistant'; content: string }[] = []
  if (rawMessages.length > 0) {
    formattedMessages = rawMessages.map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: typeof m.content === 'string' ? m.content : String(m.content || ''),
    }))
  } else if (queryStr) {
    formattedMessages = [{ role: 'user', content: queryStr }]
  }

  try {
    const result = streamText({
      model: gateway(GATEWAY_MODEL),
      experimental_telemetry: { isEnabled: true, functionId: 'support-agent' },
      system,
      messages: formattedMessages,
      tools,
      stopWhen: stepCountIs(4),
      onError({ error }) {
        console.error('[support-agent] stream error', error)
      },
    })

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let full = ''
        let emitted = 0
        const toolFrameIds = new Map<string, { id: string; detail?: string }>()
        let toolSeq = 0

        const emitFrame = (frame: ToolActivityFrame) => {
          try {
            controller.enqueue(encoder.encode(encodeToolFrame(frame)))
          } catch (err) {
            console.error('[support-agent] tool frame emit error', err)
          }
        }

        const flushProse = () => {
          if (full.length > emitted) {
            controller.enqueue(encoder.encode(sanitizeProse(full.slice(emitted))))
            emitted = full.length
          }
        }

        try {
          for await (const part of result.fullStream) {
            if (part.type === 'text-delta') {
              full += part.text
              flushProse()
            } else if (part.type === 'tool-call') {
              flushProse()
              const id = `t${toolSeq++}`
              const detail = supportToolDetail(part.toolName, part.input as Record<string, unknown>)
              toolFrameIds.set(part.toolCallId, { id, detail })
              emitFrame({ id, tool: part.toolName, state: 'input-available', detail })
            } else if (part.type === 'tool-result') {
              flushProse()
              const f = toolFrameIds.get(part.toolCallId)
              if (f) emitFrame({ id: f.id, tool: part.toolName, state: 'output-available', detail: f.detail })
            } else if (part.type === 'tool-error') {
              flushProse()
              const f = toolFrameIds.get(part.toolCallId)
              if (f) emitFrame({ id: f.id, tool: part.toolName, state: 'output-error', detail: f.detail })
            }
          }
        } catch (err) {
          console.error('[support-agent] stream pump error', err)
        }

        flushProse()
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-vercel-ai-ui': '1',
      },
    })
  } catch (err) {
    console.error('[support-agent] fallback triggered', err)
    const fallbackText = fallbackSupportAnswer(queryStr)
    return new Response(fallbackText, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }
}
