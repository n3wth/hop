'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Icon from '@/components/Icon'

// The agent front door. A prominent greeting + composer that, on submit, opens
// the conversation in /ask?q=… (the concierge auto-asks there). This is the
// PRIMARY action on the home — talking to hop comes before search/destinations.
//
// One component, two voices via `variant`:
//   • 'in'  — signed-in: warm, personal, assumes the relationship.
//   • 'out' — signed-out: the marketing promise; submit takes them into the
//             agent, which routes through sign-in when they go to act.
//
// Flat + on-brand: a dark-teal focal panel (brand-ink is an allowed surface),
// solid white input, hover = color only, motion is reduced-motion-safe via
// .hop-rise (handled globally).
export default function AgentComposer({
  variant,
  first,
  totalPoints,
}: {
  variant: 'in' | 'out'
  /** Signed-in member's first name, for the greeting. */
  first?: string
  /** Total usable points — grounds the signed-in prompt copy when present. */
  totalPoints?: number
}) {
  const router = useRouter()
  const [value, setValue] = useState('')

  function go(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return
    router.push(`/ask?q=${encodeURIComponent(trimmed)}`)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    go(value)
  }

  // Evocative starters — one tap straight into a real conversation.
  const chips =
    variant === 'in'
      ? [
          'Where can my points take me?',
          'Somewhere warm for a long weekend',
          'Best use of my Amex points',
          'A big-city food trip',
        ]
      : [
          'Somewhere warm for a long weekend',
          'Cheapest way to Tokyo',
          'Best use of my points',
          'Off the beaten path',
        ]

  const eyebrow = variant === 'in' ? 'Your points concierge' : 'Meet your travel agent'

  const heading =
    variant === 'in'
      ? first
        ? `Where to next, ${first}?`
        : 'Where to next?'
      : 'Tell hop where you want to go.'

  const sub =
    variant === 'in'
      ? totalPoints
        ? `Tell hop a vibe, a budget, or a city you can't stop thinking about. With ~${totalPoints.toLocaleString('en-US')} points, hop finds where they win — and whether to book with miles or cash.`
        : "Tell hop a vibe, a budget, or a city you can't stop thinking about — hop reads the points world and tells you where it's worth going."
      : 'Skip the search box. Just talk. hop reads award space and cash for the same trip, knows your point balances, and gives you the verdict — miles or money, which one actually wins.'

  const placeholder =
    variant === 'in'
      ? 'somewhere warm, ~40k points…'
      : 'a beach in February under 50k points…'

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-[var(--radius-hero)]"
      style={{ background: 'var(--color-brand-ink)' }}
    >
      <div className="relative flex flex-col items-center px-5 py-12 text-center sm:px-10 sm:py-16">
        <span
          className="hop-rise inline-flex items-center gap-2 rounded-full bg-[#0a5757] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6ff0d2]"
          style={{ ['--hop-delay' as string]: '40ms' }}
        >
          <Icon name="lightbulb" size={13} />
          {eyebrow}
        </span>

        <h1
          className="hop-rise mt-6 max-w-[18ch] text-balance font-display text-[36px] font-semibold leading-[1.0] tracking-[-0.03em] text-white sm:text-[56px] lg:text-[64px]"
          style={{ ['--hop-delay' as string]: '90ms' }}
        >
          {heading}
        </h1>

        <p
          className="hop-rise mt-5 max-w-[52ch] text-pretty text-[15px] leading-[1.6] text-[#c7ece5] sm:text-[17px]"
          style={{ ['--hop-delay' as string]: '140ms' }}
        >
          {sub}
        </p>

        {/* composer — the primary action */}
        <form
          onSubmit={onSubmit}
          className="hop-rise mt-8 w-full max-w-[600px]"
          style={{ ['--hop-delay' as string]: '190ms' }}
        >
          <div className="flex items-center gap-2 rounded-[18px] bg-white px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
            <Icon name="lightbulb" size={20} className="flex-shrink-0 text-brand" />
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              aria-label="Tell hop where you want to go"
              enterKeyHint="go"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-[16px] text-text outline-none placeholder:text-text3"
            />
            <button
              type="submit"
              disabled={!value.trim()}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-[#0a5757] disabled:text-[#5f9b97]"
            >
              <span className="hidden sm:inline">Ask hop</span>
              <Icon name="flight" size={16} className="rotate-90" />
            </button>
          </div>
        </form>

        {/* one-tap starters */}
        <div
          className="hop-rise mt-5 flex flex-wrap justify-center gap-2"
          style={{ ['--hop-delay' as string]: '240ms' }}
        >
          {chips.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => go(p)}
              className="rounded-full border border-[#2c6f6b] bg-[#0a5757] px-3.5 py-1.5 text-[13px] font-medium text-[#d8f1ec] transition-colors hover:border-[#6ff0d2] hover:text-white"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
