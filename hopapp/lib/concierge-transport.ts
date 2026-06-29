// ConciergeTransport — a custom AI SDK ChatTransport that lets useChat() drive
// hop's EXISTING /api/concierge endpoint without rebuilding the backend.
//
// The endpoint streams PLAIN TEXT (so the answer types out live), interleaved
// with two control channels that the public AI SDK data-stream protocol doesn't
// model:
//   • TOOL frames  — RS-delimited JSON (ToolActivityFrame) emitted as the agent
//                    calls tools mid-thought (web_search / get_weather /
//                    price_trip / save_profile_fact).
//   • A2UI envelope — the prose is followed by A2UI_SENTINEL + validated,
//                    engine-reconciled generative-UI block JSON.
//
// This transport reads that byte stream and TRANSLATES it into the
// UIMessageChunk stream useChat understands:
//   prose     -> text-start / text-delta / text-end   (rendered by <Response>)
//   tool frame -> data-tool  chunk (keyed by id; updates replace in place)
//   a2ui      -> data-a2ui  chunk (rendered inside the assistant turn)
//
// So the app gets the real useChat() multi-turn experience (status, stop,
// streaming, persisted thread) while the server contract stays exactly as built.

import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'
import { A2UI_SENTINEL, TOOL_FRAME_SEP, type ToolActivityFrame } from '@/app/api/concierge/route'
import type { A2UIBlock } from '@/lib/a2ui'

// Data parts hop attaches to an assistant UIMessage. `tool` carries one tool
// activity card (id-keyed so running -> done updates the same part); `a2ui`
// carries the validated block envelope rendered inside the turn.
export type HopDataParts = {
  tool: ToolActivityFrame
  a2ui: { blocks: A2UIBlock[] }
}

export type HopUIMessage = UIMessage<never, HopDataParts>

export interface ConciergeRequestContext {
  totalPoints?: number
  programs?: { program: string; balance: number }[]
  homeAirport?: string
}

// Convert hop's UIMessages back into the simple {role, content} thread the
// /api/concierge endpoint expects. Only text parts carry conversational content;
// tool/a2ui data parts are presentation and are dropped from the thread.
function toThread(messages: HopUIMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue
    const text = m.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('')
      .trim()
    if (text) out.push({ role: m.role, content: text })
  }
  return out
}

// The current question = the text of the last user message.
function lastQuestion(messages: HopUIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'user') continue
    const text = m.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('')
      .trim()
    if (text) return text
  }
  return ''
}

// Split a buffer into complete RS-framed tool frames + the leftover (prose +
// possibly a partial frame opener). A frame is SEP + json + SEP. We only extract
// PAIRS of separators; a dangling single SEP stays buffered until its closer
// arrives. Returns the prose-with-frames-removed and any parsed frames.
function extractToolFrames(buffer: string): {
  prose: string
  frames: ToolActivityFrame[]
  rest: string
} {
  const frames: ToolActivityFrame[] = []
  let prose = ''
  let i = 0
  while (i < buffer.length) {
    const open = buffer.indexOf(TOOL_FRAME_SEP, i)
    if (open === -1) {
      prose += buffer.slice(i)
      return { prose, frames, rest: '' }
    }
    // Prose up to the frame opener is safe to emit.
    prose += buffer.slice(i, open)
    const close = buffer.indexOf(TOOL_FRAME_SEP, open + 1)
    if (close === -1) {
      // Partial frame — keep it (and everything after the opener) buffered.
      return { prose, frames, rest: buffer.slice(open) }
    }
    const json = buffer.slice(open + 1, close)
    try {
      const frame = JSON.parse(json) as ToolActivityFrame
      if (frame && typeof frame.id === 'string' && typeof frame.tool === 'string') {
        frames.push(frame)
      }
    } catch {
      // Malformed frame — drop it silently; never corrupt the prose.
    }
    i = close + 1
  }
  return { prose, frames, rest: '' }
}

// Parse the trailing A2UI envelope JSON ("{\"blocks\":[...]}"); tolerant of a
// partial tail mid-stream (returns undefined until it parses).
function parseEnvelope(envelope: string): A2UIBlock[] | undefined {
  const s = envelope.trim()
  if (!s) return undefined
  try {
    const obj = JSON.parse(s) as { blocks?: A2UIBlock[] }
    return Array.isArray(obj?.blocks) ? obj.blocks : undefined
  } catch {
    return undefined
  }
}

export class ConciergeTransport implements ChatTransport<HopUIMessage> {
  private readonly getContext: () => ConciergeRequestContext | undefined

  constructor(getContext: () => ConciergeRequestContext | undefined) {
    this.getContext = getContext
  }

  async sendMessages(
    options: Parameters<ChatTransport<HopUIMessage>['sendMessages']>[0],
  ): Promise<ReadableStream<UIMessageChunk>> {
    const { messages, abortSignal } = options
    const question = lastQuestion(messages)
    // Thread = everything EXCEPT the just-asked question (the server appends it).
    const thread = toThread(messages)
    const priorThread = thread.length && thread[thread.length - 1].content === question
      ? thread.slice(0, -1)
      : thread
    const context = this.getContext()

    const res = await fetch('/api/concierge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortSignal,
      body: JSON.stringify({
        question,
        messages: priorThread.length ? priorThread : undefined,
        context:
          context && (context.totalPoints != null || context.homeAirport || context.programs?.length)
            ? context
            : undefined,
      }),
    })

    const reader = res.body?.getReader()
    const textId = 'answer'

    return new ReadableStream<UIMessageChunk>({
      async start(controller) {
        controller.enqueue({ type: 'start' })
        controller.enqueue({ type: 'text-start', id: textId })

        let buffer = '' // unflushed bytes (may hold a partial tool frame)
        let prose = '' // accumulated VISIBLE prose (frames removed)
        let emittedProse = 0 // chars of prose already sent as text-delta
        let sawSentinel = false

        // Emit any newly-arrived prose as a text-delta, holding back a short tail
        // so a mid-stream A2UI sentinel is never shown before we can split on it.
        const TAIL = A2UI_SENTINEL.length + 2
        const flushProse = (final: boolean) => {
          // Once the A2UI sentinel appears, prose is everything before it.
          const idx = prose.indexOf(A2UI_SENTINEL)
          const visibleEnd = idx === -1 ? prose.length : idx
          const cap = final ? visibleEnd : Math.max(emittedProse, visibleEnd - TAIL)
          if (cap > emittedProse) {
            controller.enqueue({ type: 'text-delta', id: textId, delta: prose.slice(emittedProse, cap) })
            emittedProse = cap
          }
          if (idx !== -1) sawSentinel = true
        }

        const pump = (chunk: string) => {
          buffer += chunk
          const { prose: clean, frames, rest } = extractToolFrames(buffer)
          buffer = rest
          if (clean) prose += clean
          for (const frame of frames) {
            // One data-tool part per frame; id-keyed so running -> done replaces.
            controller.enqueue({ type: 'data-tool', id: frame.id, data: frame })
          }
          flushProse(false)
        }

        try {
          if (reader) {
            const decoder = new TextDecoder()
            for (;;) {
              const { value, done } = await reader.read()
              if (done) break
              pump(decoder.decode(value, { stream: true }))
            }
            pump(decoder.decode())
          } else {
            pump(await res.text())
          }
        } catch (err) {
          controller.enqueue({ type: 'error', errorText: err instanceof Error ? err.message : 'stream error' })
        }

        // Drain any trailing buffered prose, then settle.
        if (buffer) {
          prose += buffer
          buffer = ''
        }
        flushProse(true)
        controller.enqueue({ type: 'text-end', id: textId })

        // After the sentinel: the validated A2UI block envelope -> a data part.
        if (sawSentinel) {
          const envelope = prose.slice(prose.indexOf(A2UI_SENTINEL) + A2UI_SENTINEL.length)
          const blocks = parseEnvelope(envelope)
          if (blocks && blocks.length) {
            controller.enqueue({ type: 'data-a2ui', id: 'a2ui', data: { blocks } })
          }
        }

        controller.enqueue({ type: 'finish' })
        controller.close()
      },
    })
  }

  // hop's endpoint doesn't keep resumable server streams; nothing to reconnect.
  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null
  }
}
