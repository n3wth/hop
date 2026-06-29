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
import ConciergeHero, { type ConciergeHeroPhoto } from './ConciergeHero'
import { conciergeHeroCopy } from '@/lib/concierge-hero'
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

// Starter prompts now live in lib/concierge-hero (one canonical set, shared with
// the home teaser) and are rendered by <ConciergeHero>.

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
// The immersive front door — the FULL version of the shared <ConciergeHero> the
// home teaser also renders (one visual language, one voice via
// lib/concierge-hero). It owns the photographic backdrop, headline prompt,
// composer, starters, the Gmail learn-from-trips seam, and the mood gallery.
// The first message replaces this with the conversation. The home teaser is the
// same hero, thinner; landing here from /ask?q=… reads as one continuous motion.
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
  const tiles: ConciergeHeroPhoto[] = galleryCodes
    .map((c) => photos[c])
    .filter((p): p is ConciergePhoto => Boolean(p))
    .slice(0, 6)
    .map((p) => ({ thumb: p.thumb, alt: p.alt, city: p.city, countryCode: p.countryCode }))

  const copy = conciergeHeroCopy({ signedIn, totalPoints })

  return (
    <ConciergeHero
      copy={copy}
      value={input}
      onValueChange={setInput}
      onSubmit={onSubmit}
      onChip={onStarter}
      density="full"
      signedIn={signedIn}
      submitDisabled={status !== 'ready'}
      autoFocus
      photos={tiles}
    />
  )
}
