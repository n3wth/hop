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
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useChat } from '@ai-sdk/react'
import Icon from './Icon'
import { conciergeHeroCopy } from '@/lib/concierge-hero'
import AskStart from './concierge/AskStart'
import { A2UIBlocks } from './concierge/A2UIBlock'
import type { A2UIBlock } from '@/lib/a2ui'
import {
  ConciergeTransport,
  dockChips,
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

// Fallback chips shown when a resumed thread has no model-authored follow-ups.
// Terse, on-voice, generic but useful — the dock is never dead for a returning user.
const FALLBACK_CHIPS = [
  'Plan a 5-day trip',
  'Cheaper in a different month?',
  'Compare two cities',
  'Best use of my points',
] as const

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
  /** Gmail travel-history seam is live (env flag + Google creds present). When
   *  true the in-chat / hero "Connect Gmail" become real affordances; otherwise
   *  they keep the honest "Soon" state. Computed server-side via env.ts. */
  gmailEnabled?: boolean
  /** The user's persisted thread (signed-in), hydrated into the conversation. */
  initialMessages?: ConciergeInitialMessage[]
  /** When set, the concierge auto-sends this on mount — used when the home
   *  composer deep-links into /ask?q=… so the conversation starts immediately. */
  initialQuery?: string
}

// Starter prompts now live in lib/concierge-hero (one canonical set) — rendered
// by <AskStart> on the /ask empty state and by <ConciergeHero> on the home teaser.

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
  gmailEnabled = false,
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

  const { messages, sendMessage, status, stop, setMessages, error, regenerate } =
    useChat<HopUIMessage>({
      transport,
      messages: seeded,
    })

  const router = useRouter()
  const searchParams = useSearchParams()

  const busy = status === 'submitted' || status === 'streaming'
  const hasThread = messages.length > 0
  // Model-authored follow-up suggestions from the latest assistant turn — the
  // dock renders these (contextual next steps). For resumed threads with no
  // model-authored chips, fall back to generic-but-on-voice next steps so the
  // dock is never dead; fallback only shows when idle with an existing thread.
  const followUps = useMemo(() => {
    const live = dockChips(messages)
    if (live.length) return live
    // No live chips + idle + at least one assistant message = resumed thread.
    if (!busy && messages.some((m) => m.role === 'assistant')) {
      return Array.from(FALLBACK_CHIPS)
    }
    return []
  }, [messages, busy])

  // Inline-confirm state for the destructive "start over" (the persisted thread
  // is DELETEd for signed-in users — never silently wipe it on a single tap).
  const [confirmingClear, setConfirmingClear] = useState(false)

  // aria-live status for screen readers: 'thinking' while the agent works, then
  // the final answer announced ONCE per turn (sighted users see streaming text;
  // blind users otherwise get nothing). Kept terse; not a transcript.
  // DERIVED (no effect, no setState): while busy we announce "thinking" — so the
  // SR isn't spammed token-by-token mid-stream; once the turn settles the string
  // flips to the final answer, which aria-live announces exactly once because the
  // text changes a single time. Errors announce a retry prompt.
  const liveStatus = useMemo(() => {
    if (busy) return 'hop is thinking…'
    if (status === 'error') return "hop couldn't reach its concierge. Try again."
    const last = messages[messages.length - 1]
    if (last && last.role === 'assistant') return textOf(last).trim()
    return ''
  }, [busy, status, messages])
  // True only when the signed-in visitor has real balances in play — gates the
  // ownership voice in tool labels + a2ui cards ("your points"/"you have") vs a
  // neutral value framing for signed-out / no-balance visitors.
  const hasBalances = signedIn && (programs?.length ?? 0) > 0

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

  // Live "Connect Gmail" (gated by gmailEnabled). Signed-out → sign in first,
  // returning to /ask; signed-in → start the OAuth handshake. The start route
  // self-gates and bounces to /account?gmail=unconfigured if the flag is off, so
  // this is safe even at the edge where env drifts from the rendered flag.
  const onConnectGmail = useCallback(() => {
    if (typeof window === 'undefined') return
    window.location.href = signedIn
      ? '/auth/gmail/start'
      : `/auth/login?returnTo=${encodeURIComponent('/ask')}`
  }, [signedIn])

  // "Start over" is destructive for signed-in users (it DELETEs the persisted
  // thread), so it asks for an inline confirm first. On confirm we delete the
  // server thread BEFORE clearing the client — and only clear if the delete
  // succeeded, so a failed wipe never strands the user with an empty UI but a
  // thread still on the server that will resurrect on reload.
  const clearLocal = useCallback(() => {
    setMessages([])
    setInput('')
    setConfirmingClear(false)
    // liveStatus is derived from messages — clearing the thread resets it.
  }, [setMessages])

  const startOver = useCallback(() => {
    if (!signedIn) {
      // No persisted thread to lose — clear immediately, no confirm needed.
      clearLocal()
      return
    }
    if (!confirmingClear) {
      setConfirmingClear(true)
      return
    }
    void fetch('/api/conversation', { method: 'DELETE' })
      .then((res) => {
        if (res.ok) clearLocal()
        else setConfirmingClear(false)
      })
      .catch(() => setConfirmingClear(false))
  }, [signedIn, confirmingClear, clearLocal])

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
    // Drop ?q= from the URL so a reload/share doesn't re-ask the question and
    // the address bar reflects the live conversation, not the deep link.
    if (searchParams.has('q')) {
      const next = new URLSearchParams(searchParams)
      next.delete('q')
      const qs = next.toString()
      router.replace(qs ? `/ask?${qs}` : '/ask', { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!hasThread) {
    // Empty state: a CALM CREAM editorial start (AskStart) that shares the
    // thread's measure and the SAME composer — no dark hero, no mood gallery.
    // Copy comes from lib/concierge-hero (one voice, shared with the home teaser);
    // a slim destination strip seeds a starter prompt on tap. The gets-to-know-you
    // pills are intentionally dropped here — the thread's control rail is the one
    // quiet set of controls (see the thread branch below).
    const copy = conciergeHeroCopy({ signedIn, totalPoints })
    const startTiles = galleryCodes
      .map((c) => photos[c])
      .filter((p): p is ConciergePhoto => Boolean(p))
      .slice(0, 5)
      .map((p) => ({ city: p.city, thumb: p.thumb, alt: p.alt, countryCode: p.countryCode }))
    return (
      <AskStart
        eyebrow={copy.eyebrow}
        heading={copy.heading}
        placeholder={copy.placeholder}
        chips={copy.chips}
        input={input}
        setInput={setInput}
        onSubmit={onSubmit}
        onStarter={send}
        status={status}
        onStop={stop}
        destinations={startTiles}
      />
    )
  }

  // Thread state: the conversation IS the surface. Re-apply horizontal padding
  // (AppShell uses noPadX for the ask page so the landing hero is full-bleed).
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 sm:px-8 lg:px-16">
      {/* Screen-reader live status: announces "thinking" and the settled answer
          once. Visually hidden; sighted users read the streamed text directly. */}
      <div role="status" aria-live="polite" className="sr-only">
        {liveStatus}
      </div>
      {/* control rail — a thin strip of thread controls. No bunny/wordmark here:
          the nav logo and each turn's byline already brand the surface, so a
          third mark would just be clutter. */}
      <div className="hop-ask-measure flex flex-shrink-0 items-center justify-end pb-2 pt-1">
        <div className="flex items-center gap-1.5">
          {signedIn ? (
            <Link
              href="/account"
              aria-label="What hop remembers about you"
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-text3 transition-colors hover:text-brand"
              title="See and edit what hop remembers about you"
            >
              <Icon name="loyalty" size={13} />
              <span className="hidden sm:inline">What hop remembers</span>
            </Link>
          ) : null}
          {confirmingClear ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text3">
              <span className="hidden sm:inline">Clear this thread?</span>
              <button
                type="button"
                onClick={startOver}
                className="rounded-full bg-brand px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-deep"
              >
                Yes, start over
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="rounded-full px-2.5 py-1.5 text-[12px] font-medium text-text3 transition-colors hover:text-brand"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={startOver}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-text3 transition-colors hover:text-brand"
            >
              <Icon name="lightbulb" size={13} />
              Start over
            </button>
          )}
        </div>
      </div>

      {/* the conversation — the ONLY scroll region. Full-bleed scroll, prose
          centered at a calm measure. A soft top veil dissolves content under the
          identity rail instead of a hard clip. */}
      <div className="relative min-h-0 flex-1">
        <div
          aria-hidden
          className="hop-ask-veil pointer-events-none absolute inset-x-0 top-0 z-10 h-6"
        />
        <Conversation className="h-full">
          <ConversationContent className="hop-ask-measure pb-6 pt-4">
            {messages.map((m, i) => {
              // Suppress an assistant turn that has nothing renderable yet (the
              // byline would flash empty before the first token/tool frame).
              // While busy, the ThinkingTurn covers it; this avoids a bare byline.
              if (busy && m.role === 'assistant' && !hasRenderablePart(m)) return null
              return (
                <Turn
                  key={m.id}
                  message={m}
                  onChip={send}
                  hasBalances={hasBalances}
                  homeAirport={homeAirport}
                  gmailEnabled={gmailEnabled}
                  onConnectGmail={onConnectGmail}
                  isLast={i === messages.length - 1}
                  busy={busy}
                  onRegenerate={() => void regenerate()}
                />
              )
            })}
            {/* keep the thinking indicator until the assistant turn has a
                renderable part — no empty-byline flash */}
            {busy && needsThinking(messages) ? <ThinkingTurn /> : null}
            {error ? <ErrorTurn onRetry={() => void regenerate()} /> : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      {/* pinned dock: follow-up chips above the persistent composer, aligned to
          the reading measure. Lives at the viewport floor; the thread scrolls
          behind it. */}
      <div className="hop-ask-measure flex-shrink-0 border-t border-hair pb-5 pt-3">
        {/* Follow-up chips: model-authored, contextual to the latest answer (the
            agent emits prompt_chips each turn). Shown only when idle and present. */}
        {!busy && followUps.length ? (
          <Suggestions className="mb-3">
            {followUps.map((f) => (
              <Suggestion key={f} suggestion={f} onClick={send} disabled={busy} />
            ))}
          </Suggestions>
        ) : null}

        <PromptInput onSubmit={onSubmit}>
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
    </div>
  )
}

// --- One conversation turn ---------------------------------------------------

// Render a single message. USER → a brand-tint bubble. ASSISTANT → hop byline,
// then the turn anatomy REORDERED FOR DISPLAY regardless of stream arrival order:
//   1. TOOL ACTIVITY — the agent reasoning aloud as it works (search / weather /
//      pricing), rendered FIRST as a compact inline rail.
//   2. The streamed markdown answer (<Response>) the tools informed.
//   3. Server-validated a2ui blocks (cards/choices) appended below the prose.
// The AI SDK delivers parts in stream order (text tokens often arrive before a
// tool frame resolves), so we partition by kind and lay them out by meaning —
// tools never appear after the prose they fed.
function Turn({
  message,
  onChip,
  hasBalances,
  homeAirport,
  gmailEnabled = false,
  onConnectGmail,
  isLast = false,
  busy = false,
  onRegenerate,
}: {
  message: HopUIMessage
  onChip: (p: string) => void
  hasBalances: boolean
  homeAirport?: string
  /** Gmail seam live → connect_gmail blocks render a real affordance. */
  gmailEnabled?: boolean
  /** Invoked by a live connect_gmail block (routes to login / OAuth start). */
  onConnectGmail?: () => void
  /** Last message in the thread — gates the per-turn "Retry" affordance. */
  isLast?: boolean
  /** A turn is streaming when it's the last one and the chat is busy. */
  busy?: boolean
  onRegenerate?: () => void
}) {
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

  // Render parts in stream arrival order (text and tool calls interleaved as they
  // came), with a2ui blocks always appended at the end. This lets tool calls
  // appear under the text that prompted them rather than being hoisted to the top.
  type InlinePart =
    | { kind: 'text'; key: string; text: string }
    | { kind: 'tool'; key: string; step: { tool: string; state: ToolState; detail?: string } }

  const inline: InlinePart[] = []
  const a2ui: { key: string; blocks: A2UIBlock[] }[] = []

  message.parts.forEach((part, i) => {
    if (part.type === 'text') {
      if (part.text) inline.push({ kind: 'text', key: `t${i}`, text: part.text })
    } else if (part.type === 'data-tool') {
      const frame = part.data
      inline.push({
        kind: 'tool',
        key: part.id ?? `tool${i}`,
        step: { tool: frame.tool, state: frame.state as ToolState, detail: frame.detail },
      })
    } else if (part.type === 'data-a2ui') {
      // prompt_chips surface in the composer dock (latest turn only), not inline —
      // so follow-ups live in one place and don't clutter the answer.
      const blocks = (part.data?.blocks ?? []).filter((b) => b.type !== 'prompt_chips')
      if (blocks.length) a2ui.push({ key: part.id ?? `a${i}`, blocks })
    }
  })

  // Action affordances (copy / retry) show once a turn has settled — never on the
  // turn that's actively streaming (it's the last one while busy).
  const hasText = inline.some((p) => p.kind === 'text')
  const streamingThis = busy && isLast
  const showActions = hasText && !streamingThis

  return (
    <Message from="assistant">
      <AssistantByline />
      <MessageContent>
        {/* Parts in stream order — text and tool calls interleaved chronologically.
            Streamed prose settles in via .hop-text-appear (opacity rise, no
            layout; instant under reduced-motion) so a batch reads as arriving. */}
        {inline.map((p) =>
          p.kind === 'text' ? (
            <Response key={p.key} className="hop-text-appear">
              {p.text}
            </Response>
          ) : (
            <ToolActivity key={p.key} step={p.step} hasBalances={hasBalances} />
          ),
        )}

        {/* a2ui blocks (cards / choices) always appended below the prose */}
        {a2ui.map((a) => (
          <div key={a.key} className="mt-1">
            <A2UIBlocks
              blocks={a.blocks}
              onChip={onChip}
              hasBalances={hasBalances}
              homeAirport={homeAirport}
              gmailEnabled={gmailEnabled}
              onConnectGmail={onConnectGmail}
            />
          </div>
        ))}
      </MessageContent>

      {showActions ? (
        <AssistantActions
          text={textOf(message)}
          onRegenerate={isLast && !busy ? onRegenerate : undefined}
        />
      ) : null}
    </Message>
  )
}

// Does an assistant message have anything we'd actually render (text, a tool
// frame, or an a2ui block)? Used to keep the thinking indicator up until the
// turn has real content, so the byline never flashes empty.
function hasRenderablePart(m: HopUIMessage): boolean {
  return m.parts.some(
    (p) =>
      (p.type === 'text' && !!p.text) ||
      p.type === 'data-tool' ||
      (p.type === 'data-a2ui' && (p.data?.blocks?.length ?? 0) > 0),
  )
}

// Does the latest message still need a "thinking" placeholder? True when the
// last turn is the user's (assistant hasn't started) OR a fresh assistant turn
// exists but has nothing renderable yet — so the dots stay up promptly until the
// first token, tool frame, or block arrives (no empty-byline flash between).
function needsThinking(messages: HopUIMessage[]): boolean {
  const last = messages[messages.length - 1]
  if (!last) return false
  if (last.role === 'user') return true
  return last.role === 'assistant' && !hasRenderablePart(last)
}

function textOf(m: HopUIMessage): string {
  return m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

// Per-turn affordances under a settled assistant answer: copy the prose, and
// (on the latest turn) re-roll it. Flat, quiet — muted until hover, color-only.
// "Copied" is a label/icon swap, not motion, so it's reduced-motion-safe.
function AssistantActions({
  text,
  onRegenerate,
}: {
  text: string
  onRegenerate?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard) return
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {})
  }, [text])

  const btn =
    'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-medium text-text3 transition-colors hover:bg-sunk hover:text-brand'

  return (
    <div className="-mt-0.5 flex items-center gap-0.5">
      <button type="button" onClick={copy} aria-label={copied ? 'Copied' : 'Copy answer'} className={btn}>
        <Icon name={copied ? 'check' : 'content_copy'} size={13} />
        {copied ? 'Copied' : 'Copy'}
      </button>
      {onRegenerate ? (
        <button type="button" onClick={onRegenerate} aria-label="Regenerate answer" className={btn}>
          <Icon name="refresh" size={13} />
          Retry
        </button>
      ) : null}
    </div>
  )
}

// Pre-token thinking state — a thoughtful placeholder for the answer about to
// stream: the hop byline carrying a quietly cycling status word, over a soft
// shimmer skeleton of two answer lines. The shimmer (.hop-skeleton sheen) is the
// only continuous motion; the status word crossfades in via .hop-text-appear.
// Both freeze flat under prefers-reduced-motion, where the word holds on the
// first phrase.
const THINKING_WORDS = [
  'thinking it through',
  'reading the routes',
  'weighing points vs cash',
  'pricing it out',
] as const

function ThinkingTurn() {
  // Cycle the status word slowly so it reads as deliberation, not a spinner. We
  // hold on the first phrase under reduced-motion (no interval, no crossfade).
  const [word, setWord] = useState(0)
  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const id = window.setInterval(() => {
      setWord((w) => (w + 1) % THINKING_WORDS.length)
    }, 2200)
    return () => window.clearInterval(id)
  }, [])

  return (
    <Message from="assistant">
      <AssistantByline>
        <span
          key={word}
          className="hop-text-appear text-[12px] font-medium text-text3"
          aria-hidden
        >
          {THINKING_WORDS[word]}…
        </span>
      </AssistantByline>
      <MessageContent>
        {/* shimmer skeleton of the incoming answer — two lines at a calm measure */}
        <div className="flex w-full max-w-[28rem] flex-col gap-2 py-1" aria-hidden>
          <span className="hop-skeleton hop-skeleton-line w-full" />
          <span className="hop-skeleton hop-skeleton-line w-3/5" />
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
            hop couldn&apos;t reach its concierge just then. Give it another go.
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
