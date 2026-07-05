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
import { A2UI_SENTINEL, TOOL_FRAME_SEP, TRACE_ID_HEADER, type ToolActivityFrame } from '@/app/api/concierge/route'
import type { A2UIBlock } from '@/lib/a2ui'

// Data parts hop attaches to an assistant UIMessage. `tool` carries one tool
// activity card (id-keyed so running -> done updates the same part); `a2ui`
// carries the validated block envelope rendered inside the turn; `meta` carries
// the turn's PostHog $ai_trace_id (absent when the fallback path served this
// turn, e.g. no gateway key) so a thumbs up/down can join the exact LLM call.
export type HopDataParts = {
  tool: ToolActivityFrame
  a2ui: { blocks: A2UIBlock[] }
  meta: { traceId: string }
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

// One ordered piece of the stream: a run of visible prose, or a tool frame.
type StreamEvent =
  | { kind: 'prose'; text: string }
  | { kind: 'frame'; frame: ToolActivityFrame }

// Split a buffer into ORDERED prose/frame events + the leftover. Order is the
// whole point: "prose, frameA, more prose, frameB" stays in that sequence so the
// UI can place each tool exactly where it fired — not hoisted above or below the
// whole answer. A frame is SEP + json + SEP; a dangling single SEP (a partial
// frame) stays buffered in `rest` until its closer arrives.
function extractStream(buffer: string): { events: StreamEvent[]; rest: string } {
  const events: StreamEvent[] = []
  let i = 0
  while (i < buffer.length) {
    const open = buffer.indexOf(TOOL_FRAME_SEP, i)
    if (open === -1) {
      if (i < buffer.length) events.push({ kind: 'prose', text: buffer.slice(i) })
      return { events, rest: '' }
    }
    if (open > i) events.push({ kind: 'prose', text: buffer.slice(i, open) })
    const close = buffer.indexOf(TOOL_FRAME_SEP, open + 1)
    if (close === -1) {
      // Partial frame — keep it (and everything after the opener) buffered.
      return { events, rest: buffer.slice(open) }
    }
    const json = buffer.slice(open + 1, close)
    try {
      const frame = JSON.parse(json) as ToolActivityFrame
      if (frame && typeof frame.id === 'string' && typeof frame.tool === 'string') {
        events.push({ kind: 'frame', frame })
      }
    } catch {
      // Malformed frame — drop it silently; never corrupt the prose.
    }
    i = close + 1
  }
  return { events, rest: '' }
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

    return new ReadableStream<UIMessageChunk>({
      async start(controller) {
        controller.enqueue({ type: 'start' })

        // The fallback path (no gateway key, or setup failed) never sets this
        // header — the feedback control simply doesn't render for that turn.
        const traceId = res.headers.get(TRACE_ID_HEADER)
        if (traceId) {
          controller.enqueue({ type: 'data-meta', id: 'meta', data: { traceId } })
        }

        let buffer = '' // unflushed bytes (may hold a partial tool frame)
        let prose = '' // all VISIBLE prose so far (frames removed), across segments
        let emitted = 0 // chars of prose already sent as text-delta (across segments)
        let segId: string | null = null // the currently-open text segment, or none
        let segCount = 0
        let sawSentinel = false

        // Text is emitted in SEGMENTS split at each tool frame, so a tool lands
        // between the prose before it and the prose after it — never hoisted past
        // the answer. Each segment is its own text part (text-start/delta/end).
        const openSeg = () => {
          if (segId === null) {
            segId = `t${segCount++}`
            controller.enqueue({ type: 'text-start', id: segId })
          }
        }
        const emitUpTo = (cap: number) => {
          if (cap <= emitted) return
          openSeg()
          controller.enqueue({ type: 'text-delta', id: segId as string, delta: prose.slice(emitted, cap) })
          emitted = cap
        }
        const endSeg = () => {
          if (segId !== null) {
            controller.enqueue({ type: 'text-end', id: segId })
            segId = null
          }
        }

        // Emit pending prose, holding back a short tail mid-stream so a partial
        // A2UI sentinel is never shown before we can split on it. The sentinel
        // appears once, at the very end (after all prose + tools).
        const TAIL = A2UI_SENTINEL.length + 2
        const flushProse = (final: boolean) => {
          const idx = prose.indexOf(A2UI_SENTINEL)
          const visibleEnd = idx === -1 ? prose.length : idx
          const cap = final ? visibleEnd : Math.max(emitted, visibleEnd - TAIL)
          emitUpTo(cap)
          if (idx !== -1) sawSentinel = true
        }

        const pump = (chunk: string) => {
          buffer += chunk
          const { events, rest } = extractStream(buffer)
          buffer = rest
          for (const ev of events) {
            if (ev.kind === 'prose') {
              prose += ev.text
            } else {
              // A tool fired HERE: flush the prose before it, close this text
              // segment, emit the tool. The next prose opens a fresh segment that
              // renders BELOW the tool. (No sentinel can appear mid-stream.)
              emitUpTo(prose.length)
              endSeg()
              // id-keyed so a later running -> done frame updates it in place.
              controller.enqueue({ type: 'data-tool', id: ev.frame.id, data: ev.frame })
            }
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

        // Drain any trailing buffered prose (incl. a partial frame the model never
        // closed), then settle the final segment.
        if (buffer) {
          prose += buffer
          buffer = ''
        }
        flushProse(true)
        endSeg()

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

// The model-authored follow-up chips from the LATEST assistant turn. Walks back
// to the most recent assistant message and returns its prompt_chips (the agent
// emits 3-4 contextual next-step suggestions per turn). Empty when none — e.g.
// a freshly rehydrated thread, whose persisted turns carry only text, so the
// dock simply waits for the next live turn rather than showing stale chips.
export function dockChips(messages: HopUIMessage[]): string[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'assistant') continue
    for (const part of m.parts) {
      if (part.type === 'data-a2ui') {
        const chips = part.data?.blocks?.find((b) => b.type === 'prompt_chips')
        if (chips && 'chips' in chips && Array.isArray(chips.chips) && chips.chips.length) {
          return chips.chips
        }
      }
    }
    return [] // last assistant turn had no chips — don't fall further back
  }
  return []
}
