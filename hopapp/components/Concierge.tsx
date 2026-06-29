'use client'

import { useRef, useState } from 'react'
import Icon from './Icon'
import FlyingBunny from './FlyingBunny'

// --- API contract (mirrors app/api/concierge/route.ts) ----------------------

interface Suggestion {
  code: string
  city: string
  reason: string
}

interface ConciergeResponse {
  answer: string
  suggestions?: Suggestion[]
}

export interface ConciergeProps {
  /** Total usable points across the user's programs — grounds the answer when signed in. */
  totalPoints?: number
}

// Starter prompts — the obvious first taps. Each seeds the input and submits.
const PROMPTS = [
  'Weekend, ~25k points, somewhere warm',
  'Best use of my Amex points',
  'Cheapest way to Tokyo',
] as const

// A destination suggestion links into a real hop search seeded to that city.
function searchHref(code: string): string {
  return `/search?to=${encodeURIComponent(code)}`
}

// The chat box. Posts {question, context:{totalPoints}} to /api/concierge and
// renders the warm answer + any destination cards. Flat, solid, on-brand: no
// translucency, no hover-lift. Loading shows a solid typing skeleton.
export default function Concierge({ totalPoints }: ConciergeProps) {
  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState('')
  const [result, setResult] = useState<ConciergeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function ask(q: string) {
    const trimmed = q.trim()
    if (!trimmed || loading) return
    setAsked(trimmed)
    setLoading(true)
    setError(false)
    setResult(null)
    try {
      const res = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          context: totalPoints != null ? { totalPoints } : undefined,
        }),
      })
      const data = (await res.json()) as ConciergeResponse
      setResult(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    void ask(question)
  }

  function onChip(prompt: string) {
    setQuestion(prompt)
    inputRef.current?.focus()
    void ask(prompt)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── The ask box ──────────────────────────────────────────────────── */}
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-[16px] border-[1.5px] border-border bg-surface px-3 py-2 focus-within:border-brand sm:gap-3 sm:px-4 sm:py-2.5">
          <Icon name="lightbulb" size={20} className="flex-shrink-0 text-brand" />
          <input
            ref={inputRef}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask hop where to go…"
            aria-label="Ask hop where to go"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-[16px] text-text outline-none placeholder:text-text3"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-border disabled:text-text3"
          >
            <span className="hidden sm:inline">Ask hop</span>
            <Icon name="flight" size={16} className="rotate-90" />
          </button>
        </div>

        {/* suggested prompt chips */}
        <div className="flex flex-wrap gap-2">
          {PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChip(p)}
              disabled={loading}
              className="rounded-full border border-border bg-paper px-3.5 py-1.5 text-[13px] font-medium text-text2 transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-100"
            >
              {p}
            </button>
          ))}
        </div>
      </form>

      {/* ── Results plane ────────────────────────────────────────────────── */}
      {loading ? (
        <Thinking question={asked} />
      ) : error ? (
        <ErrorNote onRetry={() => void ask(asked)} />
      ) : result ? (
        <Answer question={asked} result={result} />
      ) : (
        <EmptyState />
      )}
    </div>
  )
}

// Empty / prompt state — a warm invitation before the first ask. Solid, flat.
function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[20px] border border-border bg-paper px-6 py-12 text-center">
      <FlyingBunny size={56} carve="var(--color-paper)" />
      <p className="max-w-[40ch] text-[15px] leading-[1.6] text-text2">
        Tell hop a vibe, a budget, or a dream — &ldquo;somewhere warm for a long
        weekend,&rdquo; &ldquo;best use of my Chase points,&rdquo; or just a city
        you&apos;ve been craving. hop reads the points world and points you
        somewhere worth the trip.
      </p>
    </div>
  )
}

// Solid typing skeleton — no translucency. Shimmer bars stand in for the answer
// taking shape, with the question echoed so the wait feels grounded.
function Thinking({ question }: { question: string }) {
  return (
    <div aria-busy="true" aria-label="hop is thinking" className="flex flex-col gap-4">
      {question ? <AskedLine question={question} /> : null}
      <div className="rounded-[20px] border border-border bg-paper p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="hop-bunny-leap inline-flex">
            <FlyingBunny size={32} carve="var(--color-paper)" />
          </span>
          <span className="text-[14px] font-medium text-text3">
            hop is dreaming up some ideas…
          </span>
        </div>
        <div className="space-y-2.5">
          <span className="hop-skeleton block h-[14px] w-[92%] rounded-[6px]" />
          <span className="hop-skeleton block h-[14px] w-[80%] rounded-[6px]" />
          <span className="hop-skeleton block h-[14px] w-[64%] rounded-[6px]" />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-[14px] border border-border bg-surface p-4">
              <span className="hop-skeleton mb-3 block h-[28px] w-[44px] rounded-[8px]" />
              <span className="hop-skeleton mb-2 block h-[13px] w-[70%] rounded-[5px]" />
              <span className="hop-skeleton block h-[11px] w-[90%] rounded-[5px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// The echoed question — a small "you asked" line above the answer.
function AskedLine({ question }: { question: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex-shrink-0 text-[12px] font-semibold uppercase tracking-[0.12em] text-text3">
        You
      </span>
      <p className="text-[15px] font-medium leading-[1.5] text-text">{question}</p>
    </div>
  )
}

// The answer + suggestion cards.
function Answer({ question, result }: { question: string; result: ConciergeResponse }) {
  const suggestions = result.suggestions ?? []
  return (
    <div className="flex flex-col gap-4">
      {question ? <AskedLine question={question} /> : null}

      <div className="hop-rise rounded-[20px] border border-border bg-paper p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <FlyingBunny size={32} carve="var(--color-paper)" />
          <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-brand">
            hop
          </span>
        </div>

        <p className="whitespace-pre-line text-[16px] leading-[1.65] text-text">
          {result.answer}
        </p>

        {suggestions.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {suggestions.map((s) => (
              <SuggestionCard key={s.code + s.city} s={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// One destination card — links into a real hop search seeded to that city.
// Flat, solid, hover changes color only (no lift).
function SuggestionCard({ s }: { s: Suggestion }) {
  return (
    <a
      href={searchHref(s.code)}
      className="group flex flex-col rounded-[14px] border border-border bg-surface p-4 transition-colors hover:border-brand"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-display text-[20px] font-semibold tracking-[-0.01em] text-brand">
          {s.code}
        </span>
        <Icon
          name="flight"
          size={16}
          className="rotate-90 text-text3 transition-colors group-hover:text-brand"
        />
      </div>
      <span className="text-[15px] font-semibold text-text">{s.city}</span>
      <span className="mt-1.5 text-[13px] leading-[1.5] text-text2">{s.reason}</span>
      <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
        See the search
        <Icon name="swap_horiz" size={14} />
      </span>
    </a>
  )
}

// Network failure — friendly, with a retry. Solid surface.
function ErrorNote({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[20px] border border-border bg-paper p-6">
      <p className="text-[15px] leading-[1.6] text-text2">
        hop couldn&apos;t reach its travel brain just then. Give it another go.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-border bg-surface px-4 py-2 text-[14px] font-semibold text-text transition-colors hover:border-brand hover:text-brand"
      >
        Try again
      </button>
    </div>
  )
}
