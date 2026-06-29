'use client'

// hop's CONVERSATIONAL travel concierge, built on the Vercel AI toolkit.
//
// The thread is driven by the AI SDK useChat() hook through a custom
// ConciergeTransport (lib/concierge-transport.ts) that speaks to the EXISTING
// /api/concierge endpoint — so we get real streaming, multi-turn context
// (the full messages[] is sent each turn), status/stop, and persistence without
// touching the backend. The UI is composed from themed AI Elements
// (Conversation, Message, Response, PromptInput, Tool, Suggestion, Loader) so it
// behaves like a first-class chat surface but wears hop's flat house style.
//
// Turn anatomy: USER bubbles (right) + ASSISTANT turns (hop byline → streaming
// markdown via <Response> → tool-activity cards via <Tool> as the agent searches/
// prices/checks weather → server-validated a2ui blocks rendered INSIDE the turn).
// A warm guided LANDING (greeting, starters, mood gallery) precedes the first
// message; a persistent composer + follow-up Suggestion chips carry deliberation.

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useChat } from '@ai-sdk/react'
import Icon from './Icon'
import FlyingBunny from './FlyingBunny'
import { A2UIBlocks } from './concierge/A2UIBlock'
import {
  ConciergeTransport,
  type HopUIMessage,
  type ConciergeRequestContext,
} from '@/lib/concierge-transport'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from './ai-elements/conversation'
import { Message, MessageContent, AssistantByline } from './ai-elements/message'
import { Response } from './ai-elements/response'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from './ai-elements/prompt-input'
import { ToolActivity, type ToolState } from './ai-elements/tool'
import { Suggestions, Suggestion } from './ai-elements/suggestion'
import { Loader } from './ai-elements/loader'

// A lightweight, serializable photo record passed from the server page so the
// client can render real imagery without exposing the Unsplash key.
export interface ConciergePhoto {
  thumb: string
  alt: string
  city: string
  country: string
  countryCode: string
}

export interface ConciergeProgram {
  program: string
  balance: number
}

// A persisted thread turn ({role, content}) handed down from the server so a
// signed-in user resumes where they left off.
export interface ConciergeInitialMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ConciergeProps {
  totalPoints?: number
  programs?: ConciergeProgram[]
  homeAirport?: string
  photos?: Record<string, ConciergePhoto>
  galleryCodes?: string[]
  /** Whether the visitor is signed in — gates server persistence + start-over. */
  signedIn?: boolean
  /** The user's persisted thread (signed-in), hydrated into the conversation. */
  initialMessages?: ConciergeInitialMessage[]
  /** When set, the concierge auto-sends this on mount — used when the home
   *  composer deep-links into /ask?q=… so the conversation starts immediately. */
  initialQuery?: string
}

// Starter prompts — the obvious first taps on the landing.
const STARTERS = [
  'Somewhere warm for a long weekend',
  'Best use of my Amex points',
  'Cheapest way to Tokyo',
  'A big-city food trip',
  'Off the beaten path',
] as const

// Follow-up chips that keep the deliberation going — composer stays primary.
const FOLLOW_UPS = ['Compare these', 'Cheaper', 'Best weather', "When's cheapest"] as const

let initialIdSeq = 0

// Turn the persisted {role,content} thread into seeded UIMessages so useChat
// hydrates the conversation on load.
function toInitialMessages(initial: ConciergeInitialMessage[] | undefined): HopUIMessage[] {
  if (!initial?.length) return []
  return initial.map((m) => ({
    id: `seed-${initialIdSeq++}`,
    role: m.role,
    parts: [{ type: 'text' as const, text: m.content }],
  }))
}

export default function Concierge({
  totalPoints,
  programs,
  homeAirport,
  photos = {},
  galleryCodes = [],
  signedIn = false,
  initialMessages,
  initialQuery,
}: ConciergeProps) {
  const [input, setInput] = useState('')

  // Context is read fresh on each send so balances/airport are always current.
  // The ref is kept in sync via an effect (never mutated during render); the
  // transport reads ctxRef.current lazily at send-time, so it always sees latest.
  const ctxRef = useRef<ConciergeRequestContext | undefined>({ totalPoints, programs, homeAirport })
  useEffect(() => {
    ctxRef.current = { totalPoints, programs, homeAirport }
  }, [totalPoints, programs, homeAirport])
  // Stable accessor the transport calls lazily at send-time — reads the ref then,
  // never during render, so it always sees the latest context. The lint rule
  // can't see that the closure defers the read past render (the access only
  // happens inside ConciergeTransport.sendMessages), hence the scoped disable.
  const getContext = useCallback(() => ctxRef.current, [])
  // eslint-disable-next-line react-hooks/refs
  const transport = useMemo(() => new ConciergeTransport(getContext), [getContext])

  const seeded = useMemo(() => toInitialMessages(initialMessages), [initialMessages])

  const { messages, sendMessage, status, stop, setMessages, error } = useChat<HopUIMessage>({
    transport,
    messages: seeded,
  })

  const busy = status === 'submitted' || status === 'streaming'
  const hasThread = messages.length > 0

  const send = useCallback(
    (text: string) => {
      const t = text.trim()
      if (!t || busy) return
      setInput('')
      void sendMessage({ text: t })
    },
    [busy, sendMessage],
  )

  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      send(input)
    },
    [input, send],
  )

  // Quiet "start over" — clears the live thread and (signed-in) the server one.
  const startOver = useCallback(() => {
    setMessages([])
    setInput('')
    if (signedIn) {
      void fetch('/api/conversation', { method: 'DELETE' }).catch(() => {})
    }
  }, [setMessages, signedIn])

  // Auto-ask once when handed an initialQuery (e.g. the home composer deep-linked
  // into /ask?q=…). Guarded so it fires a single time, never on re-render, and
  // never when a persisted thread was already hydrated (don't re-ask a resume).
  const autoAskedRef = useRef(false)
  useEffect(() => {
    if (autoAskedRef.current) return
    const q = initialQuery?.trim()
    if (!q || seeded.length) return
    autoAskedRef.current = true
    void sendMessage({ text: q })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!hasThread) {
    return (
      <Landing
        input={input}
        setInput={setInput}
        onSubmit={onSubmit}
        onStarter={send}
        status={status}
        photos={photos}
        galleryCodes={galleryCodes}
        totalPoints={totalPoints}
        signedIn={signedIn}
      />
    )
  }

  return (
    <div className="flex h-[clamp(520px,76vh,820px)] flex-col gap-3">
      {/* thread header: identity + start over + what-hop-remembers */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlyingBunny size={26} carve="var(--color-bg)" />
          <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-brand">
            hop concierge
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {signedIn ? (
            <a
              href="/account"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-paper px-3 py-1.5 text-[12px] font-medium text-text2 transition-colors hover:border-brand hover:text-brand"
              title="See and edit what hop remembers about you"
            >
              <Icon name="loyalty" size={13} />
              What hop remembers
            </a>
          ) : null}
          <button
            type="button"
            onClick={startOver}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-paper px-3 py-1.5 text-[12px] font-medium text-text2 transition-colors hover:border-brand hover:text-brand"
          >
            <Icon name="lightbulb" size={13} />
            Start over
          </button>
        </div>
      </div>

      {/* the conversation — auto-scrolls, scroll-up to read history */}
      <Conversation className="min-h-0 rounded-[20px] border border-border bg-bg px-3 py-4 sm:px-5">
        <ConversationContent>
          {messages.map((m) => (
            <Turn key={m.id} message={m} onChip={send} />
          ))}
          {/* a fresh assistant turn that hasn't streamed text yet → thinking */}
          {busy && needsThinking(messages) ? <ThinkingTurn /> : null}
          {error ? <ErrorTurn onRetry={() => send(lastUserText(messages))} /> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* follow-up chips — deliberation shortcuts; composer stays primary */}
      <Suggestions>
        {FOLLOW_UPS.map((f) => (
          <Suggestion key={f} suggestion={f} onClick={send} />
        ))}
      </Suggestions>

      {/* persistent composer */}
      <PromptInput onSubmit={onSubmit}>
        <Icon name="lightbulb" size={20} className="mb-1.5 flex-shrink-0 text-brand" />
        <PromptInputTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onEnter={() => send(input)}
          placeholder="Reply, or ask something new…"
          aria-label="Message hop"
        />
        <PromptInputSubmit status={status} onStop={stop} disabled={!input.trim()} />
      </PromptInput>
    </div>
  )
}

// --- One conversation turn ---------------------------------------------------

// Render a single message. USER → a brand-tint bubble. ASSISTANT → hop byline,
// then its parts IN ORDER: streamed markdown (<Response>), tool-activity cards
// (<Tool>), and server-validated a2ui blocks rendered inside the turn.
function Turn({ message, onChip }: { message: HopUIMessage; onChip: (p: string) => void }) {
  if (message.role === 'user') {
    const text = textOf(message)
    return (
      <Message from="user">
        <MessageContent>
          <span className="leading-[1.5]">{text}</span>
        </MessageContent>
      </Message>
    )
  }

  return (
    <Message from="assistant">
      <AssistantByline />
      <MessageContent>
        {message.parts.map((part, i) => {
          if (part.type === 'text') {
            return part.text ? <Response key={i}>{part.text}</Response> : null
          }
          if (part.type === 'data-tool') {
            const frame = part.data
            return (
              <ToolActivity
                key={part.id ?? i}
                step={{ tool: frame.tool, state: frame.state as ToolState, detail: frame.detail }}
              />
            )
          }
          if (part.type === 'data-a2ui') {
            const blocks = part.data?.blocks ?? []
            return blocks.length ? (
              <div key={part.id ?? i} className="mt-1">
                <A2UIBlocks blocks={blocks} onChip={onChip} />
              </div>
            ) : null
          }
          return null
        })}
      </MessageContent>
    </Message>
  )
}

// Does the latest message still need a "thinking" placeholder? True when the
// last turn is the user's (assistant hasn't started) — so the dots show up
// promptly before the first token or tool frame arrives.
function needsThinking(messages: HopUIMessage[]): boolean {
  const last = messages[messages.length - 1]
  return !!last && last.role === 'user'
}

function textOf(m: HopUIMessage): string {
  return m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

function lastUserText(messages: HopUIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return textOf(messages[i])
  }
  return ''
}

// Pre-token thinking state inside an assistant turn — the flying bunny + a quiet
// "dreaming up ideas" line with the brand Loader. Flat; motion is the Loader
// only (reduced-motion-safe).
function ThinkingTurn() {
  return (
    <Message from="assistant">
      <AssistantByline />
      <MessageContent>
        <div className="flex items-center gap-2.5 text-text3">
          <Loader size={15} className="text-brand" />
          <span className="text-[14px]">hop is dreaming up some ideas…</span>
        </div>
      </MessageContent>
    </Message>
  )
}

function ErrorTurn({ onRetry }: { onRetry: () => void }) {
  return (
    <Message from="assistant">
      <AssistantByline />
      <MessageContent>
        <div className="flex flex-col items-start gap-2.5 rounded-[14px] border border-border bg-paper p-4">
          <p className="text-[14px] leading-[1.6] text-text2">
            hop couldn&apos;t reach its travel brain just then. Give it another go.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-text transition-colors hover:border-brand hover:text-brand"
          >
            Try again
          </button>
        </div>
      </MessageContent>
    </Message>
  )
}

// --- Warm guided landing -----------------------------------------------------
// The immersive front door: a real-photography backdrop (scrimmed), the headline
// prompt, the central composer, evocative starters, the Gmail learn-from-trips
// seam, and a mood gallery. First message replaces this with the conversation.
function Landing({
  input,
  setInput,
  onSubmit,
  onStarter,
  status,
  photos,
  galleryCodes,
  totalPoints,
  signedIn,
}: {
  input: string
  setInput: (v: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onStarter: (p: string) => void
  status: 'submitted' | 'streaming' | 'ready' | 'error'
  photos: Record<string, ConciergePhoto>
  galleryCodes: string[]
  totalPoints?: number
  signedIn: boolean
}) {
  const tiles = galleryCodes
    .map((c) => photos[c])
    .filter(Boolean)
    .slice(0, 6) as ConciergePhoto[]
  const backdrop = tiles[0]

  return (
    <div
      className="relative flex min-h-[clamp(440px,72vh,680px)] flex-col overflow-hidden rounded-[var(--radius-hero)]"
      style={{ background: 'var(--color-brand-ink)' }}
    >
      {backdrop ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backdrop.thumb}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
        />
      ) : null}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(7,62,62,0.62) 0%, rgba(7,62,62,0.86) 55%, rgba(7,62,62,0.97) 100%)',
        }}
      />

      <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-12 text-center sm:px-10">
        <span
          className="hop-rise inline-flex items-center gap-2 rounded-full bg-[#0a5757] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6ff0d2]"
          style={{ ['--hop-delay' as string]: '40ms' }}
        >
          <Icon name="lightbulb" size={13} />
          Your points concierge
        </span>

        <h2
          className="hop-rise mt-6 font-display text-[40px] font-semibold leading-[1.0] tracking-[-0.03em] text-white sm:text-[64px]"
          style={{ ['--hop-delay' as string]: '90ms' }}
        >
          Where to next?
        </h2>

        <p
          className="hop-rise mt-4 max-w-[46ch] text-[15px] leading-[1.6] text-[#c7ece5] sm:text-[16px]"
          style={{ ['--hop-delay' as string]: '140ms' }}
        >
          {totalPoints
            ? `Tell hop a vibe, a budget, or a city you can't stop thinking about. With ~${totalPoints.toLocaleString('en-US')} points, hop finds where they win — then talks it through with you.`
            : "Tell hop a vibe, a budget, or a city you can't stop thinking about — hop reads the points world and talks the trade-offs through with you."}
        </p>

        {/* central composer — prominent, the obvious action */}
        <form
          onSubmit={onSubmit}
          className="hop-rise mt-8 w-full max-w-[560px]"
          style={{ ['--hop-delay' as string]: '190ms' }}
        >
          <div className="flex items-center gap-2 rounded-[18px] bg-white px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
            <Icon name="lightbulb" size={20} className="flex-shrink-0 text-brand" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="somewhere warm, ~40k points…"
              aria-label="Ask hop where to go"
              enterKeyHint="send"
              autoFocus
              className="min-w-0 flex-1 bg-transparent py-1.5 text-[16px] text-text outline-none placeholder:text-text3"
            />
            <button
              type="submit"
              disabled={!input.trim() || status !== 'ready'}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-border disabled:text-text3"
            >
              <span className="hidden sm:inline">Ask hop</span>
              <Icon name="flight" size={16} className="rotate-90" />
            </button>
          </div>
        </form>

        {/* evocative starters */}
        <div
          className="hop-rise mt-5 flex flex-wrap justify-center gap-2"
          style={{ ['--hop-delay' as string]: '240ms' }}
        >
          {STARTERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onStarter(p)}
              className="rounded-full border border-[#2c6f6b] bg-[#0a5757] px-3.5 py-1.5 text-[13px] font-medium text-[#d8f1ec] transition-colors hover:border-[#6ff0d2] hover:text-white"
            >
              {p}
            </button>
          ))}
        </div>

        {/* gets-to-know-you affordances: Gmail seam + what-hop-remembers */}
        <div
          className="hop-rise mt-4 flex flex-wrap items-center justify-center gap-2"
          style={{ ['--hop-delay' as string]: '300ms' }}
        >
          <button
            type="button"
            disabled
            aria-disabled
            title="Coming soon — let hop learn from your past trips"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-full border border-[#2c6f6b] bg-transparent px-3.5 py-1.5 text-[12px] font-medium text-[#9fd6cd]"
          >
            <Icon name="loyalty" size={14} className="flex-shrink-0" />
            Connect Gmail to learn from past trips
            <span className="rounded-full bg-[#0a5757] px-1.5 py-px text-[10px] uppercase tracking-wide text-[#d8f1ec]">
              Soon
            </span>
          </button>
          {signedIn ? (
            <a
              href="/account"
              className="flex items-center gap-1.5 rounded-full border border-[#2c6f6b] bg-transparent px-3.5 py-1.5 text-[12px] font-medium text-[#9fd6cd] transition-colors hover:border-[#6ff0d2] hover:text-white"
            >
              <Icon name="info" size={14} className="flex-shrink-0" />
              What hop remembers
            </a>
          ) : null}
        </div>
      </div>

      {/* mood gallery — sets the tone at the base of the panel */}
      {tiles.length > 0 ? (
        <div
          className="hop-rise relative grid grid-cols-3 gap-px bg-[#0a4f4f] sm:grid-cols-6"
          style={{ ['--hop-delay' as string]: '300ms' }}
        >
          {tiles.map((t, i) => (
            <div
              key={t.city + i}
              className={`relative aspect-[4/3] overflow-hidden ${i >= 3 ? 'hidden sm:block' : ''}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.thumb} alt={t.alt} loading="lazy" className="h-full w-full object-cover" />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background: 'linear-gradient(to top, rgba(7,62,62,0.82) 0%, rgba(7,62,62,0) 60%)',
                }}
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 p-2">
                <span
                  className={`fi fi-${t.countryCode} h-[10px] w-[14px] flex-shrink-0 rounded-[1px]`}
                  aria-hidden
                />
                <span className="truncate text-[11px] font-semibold text-white">{t.city}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
