'use client'

// COUNTERFACTUAL YOU — the "What if…" surface. Travel's first financial mirror.
// A minimal input + flat result panel that asks "what if I had a different points
// portfolio?" and shows what UNLOCKS, using ENGINE numbers only.
//
// The client never computes economics: it POSTs the question to
// /api/counterfactual, which translates it to a Mutation and runs hop's
// deterministic engine against the user's real balances. Every figure rendered
// here ("you'd unlock N trips worth about $Y") comes straight from that response.
// Flat + on-brand (brand tokens only, no shadows/gradients/glows; hover = color),
// no emojis.

import { useState } from 'react'
import Link from 'next/link'
import Icon from './Icon'
import Card from './ui/Card'
import Eyebrow from './ui/Eyebrow'

// --- Response shape (mirrors lib/counterfactual.CounterfactualResult) ---------

interface UnlockedDestination {
  code: string
  city: string
  country: string
  countryCode: string
  region: string
  bestProgram: string
  milesNeeded: number
  cashUsd: number
  cpp: number | undefined
}

interface ImprovedDestination {
  code: string
  city: string
  country: string
  bestProgram: string
  beforeYouHave: number
  afterYouHave: number
  milesNeeded: number
  beforeAffordable: boolean
  afterAffordable: boolean
}

interface CounterfactualResult {
  mutation: { op: 'add' | 'set' | 'swap'; label: string }
  unlocked: UnlockedDestination[]
  improved: ImprovedDestination[]
  dollarValue: number
  unlockedCount: number
}

type ApiResponse =
  | { ok: true; result: CounterfactualResult }
  | { ok: false; reason: string }

// A held program, for deriving portfolio-aware presets.
export interface CounterfactualProgram {
  program: string
  balance: number
}

// Generic fallback when the user holds nothing — every preset must still be a
// real, runnable question.
const FALLBACK_SUGGESTIONS = [
  'What if I had 50k Chase UR',
  'What if I had 100k Amex MR',
  'What if I held Alaska instead of Delta',
]

// Derive presets from THIS user's real stack so the mirror reflects them, not a
// stranger: "+50k of your largest program", "double your largest", and a swap of
// their two biggest holdings. Falls back to generic prompts with no programs.
function suggestionsFor(programs: CounterfactualProgram[]): string[] {
  const held = programs.filter((p) => p && p.program && p.balance > 0)
  if (held.length === 0) return FALLBACK_SUGGESTIONS
  const sorted = [...held].sort((a, b) => b.balance - a.balance)
  const top = sorted[0]
  const out = [`What if I had 50k more ${top.program}`, `What if I doubled my ${top.program}`]
  if (sorted[1]) out.push(`What if I held ${sorted[1].program} instead of ${top.program}`)
  return out
}

export default function Counterfactual({
  programs = [],
}: {
  /** The signed-in user's real balances, so presets reflect THIS portfolio. */
  programs?: CounterfactualProgram[]
}) {
  const SUGGESTIONS = suggestionsFor(programs)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CounterfactualResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(question: string) {
    const q = question.trim()
    if (!q || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/counterfactual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: q }),
      })
      const data = (await res.json()) as ApiResponse
      if (data.ok) {
        setResult(data.result)
      } else {
        setResult(null)
        setError(data.reason || "I couldn't run that one. Try rephrasing.")
      }
    } catch {
      setResult(null)
      setError("I couldn't reach the mirror just now. Try again in a moment.")
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    void run(text)
  }

  return (
    <Card surface="surface" radius="md" className="mt-4 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-[12px] bg-brand-light text-brand">
          <Icon name="swap_horiz" size={24} weight="fill" />
        </span>
        <div className="min-w-0">
          <p className="max-w-[58ch] text-[14px] leading-[1.5] text-text2">
            A mirror for your portfolio. Ask what a different points stack would unlock — hop
            re-runs its real engine against your balances and shows the trips that open up.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What if I had 50k more Chase UR?"
          aria-label="Describe a different points portfolio"
          className="no-inner-ring min-w-0 flex-1 rounded-[12px] border border-border bg-paper px-4 py-2.5 text-[14px] text-text outline-none transition-colors placeholder:text-text3 focus:border-brand"
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-[12px] bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-default disabled:opacity-50"
        >
          {loading ? 'Mirroring…' : 'Show me'}
        </button>
      </form>

      {/* discoverable prompts */}
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={loading}
            onClick={() => {
              setText(s)
              void run(s)
            }}
            className="rounded-full border border-border bg-paper px-3 py-1.5 text-[12.5px] font-medium text-text2 transition-colors hover:border-brand hover:text-brand disabled:cursor-default disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-[12px] border border-border bg-sunk px-4 py-2.5 text-[13px] text-text2">
          {error}
        </p>
      ) : null}

      {result ? <ResultPanel result={result} /> : null}
    </Card>
  )
}

// --- Result panel (engine numbers only) --------------------------------------

function ResultPanel({ result }: { result: CounterfactualResult }) {
  const { unlocked, improved, dollarValue, unlockedCount, mutation } = result
  // Improved-but-not-unlocked: closer-but-not-there headroom gains worth noting.
  const closer = improved.filter((d) => !d.afterAffordable)

  return (
    <div className="mt-5 border-t border-border pt-5">
      {/* headline — the one-glance financial mirror */}
      <div className="rounded-[14px] bg-brand-light px-5 py-4">
        <Eyebrow className="text-brand">
          {mutation.label}
        </Eyebrow>
        {unlockedCount > 0 ? (
          <p className="mt-1.5 font-display text-[18px] font-semibold leading-snug tracking-[-0.01em] text-brand-deep">
            You&apos;d unlock {unlockedCount} {unlockedCount === 1 ? 'trip' : 'trips'} worth about{' '}
            <span className="hop-num">${dollarValue.toLocaleString('en-US')}</span> in cash flights.
          </p>
        ) : closer.length > 0 ? (
          <p className="mt-1.5 font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-brand-deep">
            No new trips cross the line yet, but {closer.length}{' '}
            {closer.length === 1 ? 'destination gets' : 'destinations get'} closer.
          </p>
        ) : (
          <p className="mt-1.5 text-[14px] leading-snug text-brand-deep">
            That change doesn&apos;t move any of hop&apos;s destinations — your portfolio already
            covers what it would unlock, or it routes to programs hop doesn&apos;t book.
          </p>
        )}
      </div>

      {/* unlocked destinations */}
      {unlocked.length > 0 ? (
        <div className="mt-4">
          <Eyebrow className="mb-2 block text-text3">
            Newly within reach
          </Eyebrow>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {unlocked.map((d) => (
              <UnlockedCard key={d.code} d={d} />
            ))}
          </div>
        </div>
      ) : null}

      {/* closer-but-not-there */}
      {closer.length > 0 ? (
        <div className="mt-4">
          <Eyebrow className="mb-2 block text-text3">
            Getting closer
          </Eyebrow>
          <div className="flex flex-col gap-1.5">
            {closer.slice(0, 4).map((d) => (
              <CloserRow key={d.code} d={d} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function UnlockedCard({ d }: { d: UnlockedDestination }) {
  return (
    <Link href={`/search?to=${encodeURIComponent(d.code)}`}>
      <Card surface="paper" radius="sm" interactive className="group flex flex-col p-3.5">
        <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`fi fi-${d.countryCode} h-[14px] w-[19px] flex-shrink-0 rounded-[2px]`}
            aria-hidden
          />
          <span className="font-display text-[15px] font-semibold leading-tight text-text">
            {d.city}
          </span>
        </div>
        {d.cpp != null ? (
          <span className="hop-num rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand">
            {d.cpp.toFixed(1)}¢
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline justify-between text-[12px]">
        <span className="text-text3">
          {Math.round(d.milesNeeded / 1000)}k pts
          <span className="ml-1 text-text3">· {d.bestProgram}</span>
        </span>
        <span className="hop-num font-semibold text-text2">
          ${d.cashUsd.toLocaleString('en-US')} cash
        </span>
      </div>
      </Card>
    </Link>
  )
}

function CloserRow({ d }: { d: ImprovedDestination }) {
  const gap = Math.max(0, d.milesNeeded - d.afterYouHave)
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-[10px] bg-sunk px-3.5 py-2 text-[13px]">
      <span className="min-w-0 truncate font-medium text-text">{d.city}</span>
      <span className="hop-num flex-shrink-0 text-text3">
        {gap > 0 ? `${gap.toLocaleString('en-US')} pts short` : 'almost there'}
      </span>
    </div>
  )
}
