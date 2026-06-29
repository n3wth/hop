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

// A lightweight, serializable photo record passed from the server page so the
// client can render real imagery without exposing the Unsplash key. Keyed by
// destination IATA code.
export interface ConciergePhoto {
  thumb: string
  alt: string
  city: string
  country: string
  countryCode: string
}

export interface ConciergeProps {
  /** Total usable points across the user's programs — grounds the answer when signed in. */
  totalPoints?: number
  /** code → photo, for the mood gallery + suggestion cards. */
  photos?: Record<string, ConciergePhoto>
  /** Codes to feature in the landing mood gallery, best-value first. */
  galleryCodes?: string[]
}

// Starter prompts — the obvious first taps. Each seeds the input and submits.
const PROMPTS = [
  'Somewhere warm for a long weekend',
  'Best use of my Amex points',
  'Cheapest way to Tokyo',
  'A big-city food trip',
  'Off the beaten path',
] as const

// A destination suggestion links into a real hop search seeded to that city.
function searchHref(code: string): string {
  return `/search?to=${encodeURIComponent(code)}`
}

// hop's concierge. LANDING state is an immersive, app-like front door: a warm
// focal prompt, a prominent central input, evocative chips, and a backdrop of
// real destination photography to set the mood. After an ask, the dark panel
// gives way to a clean answer with photo-led suggestion cards. Flat + solid: the
// dark-teal surface and image scrims are the only allowed depth; no hover-lift.
export default function Concierge({ totalPoints, photos = {}, galleryCodes = [] }: ConciergeProps) {
  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState('')
  const [result, setResult] = useState<ConciergeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Before the first ask we show the immersive landing; once asked, we switch
  // to the results view (a compact ask bar + the answer).
  const hasAsked = loading || error || result !== null

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
    void ask(prompt)
  }

  function reset() {
    setResult(null)
    setError(false)
    setAsked('')
    setQuestion('')
    inputRef.current?.focus()
  }

  if (!hasAsked) {
    return (
      <Landing
        question={question}
        setQuestion={setQuestion}
        onSubmit={onSubmit}
        onChip={onChip}
        inputRef={inputRef}
        photos={photos}
        galleryCodes={galleryCodes}
        totalPoints={totalPoints}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* compact ask bar (back to mood when cleared) */}
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
      </form>

      {loading ? (
        <Thinking question={asked} />
      ) : error ? (
        <ErrorNote onRetry={() => void ask(asked)} />
      ) : result ? (
        <Answer question={asked} result={result} photos={photos} onReset={reset} />
      ) : null}
    </div>
  )
}

// ── Immersive landing ────────────────────────────────────────────────────────
// Dark-teal focal panel: a real photography backdrop (scrimmed for legibility),
// the headline prompt, the central input, and evocative chips. Designed to fill
// the viewport on desktop so /ask feels like opening a travel app.
function Landing({
  question,
  setQuestion,
  onSubmit,
  onChip,
  inputRef,
  photos,
  galleryCodes,
  totalPoints,
}: {
  question: string
  setQuestion: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onChip: (p: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  photos: Record<string, ConciergePhoto>
  galleryCodes: string[]
  totalPoints?: number
}) {
  const tiles = galleryCodes.map((c) => photos[c]).filter(Boolean).slice(0, 6) as ConciergePhoto[]
  const backdrop = tiles[0]

  return (
    <div
      className="relative flex min-h-[clamp(440px,72vh,680px)] flex-col overflow-hidden rounded-[var(--radius-hero)]"
      style={{ background: 'var(--color-brand-ink)' }}
    >
      {/* photography backdrop + scrim (image overlay, not a UI surface) */}
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

      {/* content */}
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
            ? `Tell hop a vibe, a budget, or a city you can't stop thinking about. With ~${totalPoints.toLocaleString('en-US')} points, hop finds where they win.`
            : "Tell hop a vibe, a budget, or a city you can't stop thinking about — hop reads the points world and finds where it's worth going."}
        </p>

        {/* central input — prominent, the obvious action */}
        <form
          onSubmit={onSubmit}
          className="hop-rise mt-8 w-full max-w-[560px]"
          style={{ ['--hop-delay' as string]: '190ms' }}
        >
          <div className="flex items-center gap-2 rounded-[18px] bg-white px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
            <Icon name="lightbulb" size={20} className="flex-shrink-0 text-brand" />
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="somewhere warm, ~40k points…"
              aria-label="Ask hop where to go"
              enterKeyHint="search"
              autoFocus
              className="min-w-0 flex-1 bg-transparent py-1.5 text-[16px] text-text outline-none placeholder:text-text3"
            />
            <button
              type="submit"
              disabled={!question.trim()}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-border disabled:text-text3"
            >
              <span className="hidden sm:inline">Ask hop</span>
              <Icon name="flight" size={16} className="rotate-90" />
            </button>
          </div>
        </form>

        {/* evocative prompt chips */}
        <div
          className="hop-rise mt-5 flex flex-wrap justify-center gap-2"
          style={{ ['--hop-delay' as string]: '240ms' }}
        >
          {PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChip(p)}
              className="rounded-full border border-[#2c6f6b] bg-[#0a5757] px-3.5 py-1.5 text-[13px] font-medium text-[#d8f1ec] transition-colors hover:border-[#6ff0d2] hover:text-white"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* inspiring thumbnail strip — sets the mood at the base of the panel */}
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
                <span className={`fi fi-${t.countryCode} h-[10px] w-[14px] flex-shrink-0 rounded-[1px]`} aria-hidden />
                <span className="truncate text-[11px] font-semibold text-white">{t.city}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
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
            <div key={i} className="overflow-hidden rounded-[14px] border border-border bg-surface">
              <span className="hop-skeleton block aspect-[16/10] w-full" />
              <div className="p-3">
                <span className="hop-skeleton mb-2 block h-[13px] w-[70%] rounded-[5px]" />
                <span className="hop-skeleton block h-[11px] w-[90%] rounded-[5px]" />
              </div>
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

// The answer + photo-led suggestion cards.
function Answer({
  question,
  result,
  photos,
  onReset,
}: {
  question: string
  result: ConciergeResponse
  photos: Record<string, ConciergePhoto>
  onReset: () => void
}) {
  const suggestions = result.suggestions ?? []
  return (
    <div className="flex flex-col gap-4">
      {question ? <AskedLine question={question} /> : null}

      <div className="hop-rise rounded-[20px] border border-border bg-paper p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FlyingBunny size={32} carve="var(--color-paper)" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-brand">
              hop
            </span>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-text2 transition-colors hover:border-brand hover:text-brand"
          >
            <Icon name="lightbulb" size={13} />
            New ask
          </button>
        </div>

        <p className="whitespace-pre-line text-[16px] leading-[1.65] text-text">
          {result.answer}
        </p>

        {suggestions.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {suggestions.map((s) => (
              <SuggestionCard key={s.code + s.city} s={s} photo={photos[s.code]} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// One destination card — a real photo header with city + flag, then the reason.
// Links into a real hop search seeded to that city. Flat, solid; hover scales the
// image inside its clipped frame and tints the border (no card lift).
function SuggestionCard({ s, photo }: { s: Suggestion; photo?: ConciergePhoto }) {
  return (
    <a
      href={searchHref(s.code)}
      className="group flex flex-col overflow-hidden rounded-[14px] border border-border bg-surface transition-colors hover:border-brand"
    >
      <div
        className="relative aspect-[16/10] w-full overflow-hidden"
        style={{ background: 'var(--color-brand-deep)' }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.thumb}
            alt={photo.alt}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div aria-hidden className="h-full w-full" style={{ background: 'var(--color-brand-deep)' }} />
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(7,62,62,0.78) 0%, rgba(7,62,62,0) 58%)',
          }}
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-1.5 p-2.5">
          {photo ? (
            <span className={`fi fi-${photo.countryCode} mb-0.5 h-[11px] w-[15px] flex-shrink-0 rounded-[2px]`} aria-hidden />
          ) : null}
          <span className="truncate font-display text-[16px] font-semibold leading-tight text-white">
            {s.city}
          </span>
          <span className="ml-auto rounded-full bg-white/90 px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-brand">
            {s.code}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <span className="text-[13px] leading-[1.5] text-text2">{s.reason}</span>
        <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
          See the search
          <Icon name="swap_horiz" size={14} />
        </span>
      </div>
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
