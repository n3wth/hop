'use client'

// AskStart — the /ask empty-state GREETING, a calm cream editorial start.
//
// This is presentational only: a small brand eyebrow, a display heading, a
// one-line subhead, and an optional slim destination strip that seeds a starter
// prompt on tap. It carries NO composer and NO starter chips — those live in the
// concierge's shared dock (components/Concierge), docked at the floor in BOTH the
// empty and thread states, so sending the first message swaps only this greeting
// for the streamed conversation with zero layout jump. The concierge centers this
// block vertically inside the single scroll region.
//
// Flat + on-brand: paper elements on the cream canvas, brand tokens, hover = color
// only, motion is reduced-motion-safe (.hop-rise is inert). No dark backdrop, no
// mood gallery. Copy comes from lib/concierge-hero (one voice, shared with home).

import Icon, { type IconName } from '@/components/Icon'

// Grounds the greeting in what the engine actually does (CLAUDE.md's verdict
// invariants), not marketing filler — and renders unconditionally, so the
// empty state has real substance even when destinationImages() has nothing
// (no UNSPLASH_ACCESS_KEY configured) rather than depending entirely on an
// external photo API to not look sparse.
const HOW_HOP_ANSWERS: { icon: IconName; label: string }[] = [
  { icon: 'wallet', label: 'Your real balances' },
  { icon: 'flight', label: 'Live award space' },
  { icon: 'currency', label: 'Real cash prices' },
]

// A slim destination tile — a small rounded thumbnail that seeds a starter prompt
// on tap. Serializable (the server already passes this shape down to Concierge).
export interface AskStartDestination {
  city: string
  thumb: string
  alt: string
  countryCode: string
}

export interface AskStartProps {
  /** Resolved copy from lib/concierge-hero (one source, shared with the home). */
  eyebrow: string
  heading: string
  /** The canonical subhead — for signed-in visitors this states their points
   *  number ("With ~40,000 points…"). Shared with the home so the two never drift. */
  sub: string
  /** Send a destination-tile prompt straight through (wired to useChat). */
  onStarter: (prompt: string) => void
  /** Optional quiet destination strip; omit for a greeting-only start. */
  destinations?: AskStartDestination[]
}

export default function AskStart({
  eyebrow,
  heading,
  sub,
  onStarter,
  destinations = [],
}: AskStartProps) {
  return (
    <div
      className="hop-rise flex w-full max-w-[880px] flex-col items-center px-2 text-center"
      style={{ ['--hop-delay' as string]: '40ms' }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand sm:text-[12px]">
        {eyebrow}
      </span>

      <h1 className="mt-4 text-balance font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.02em] text-text sm:text-[42px] lg:text-[48px]">
        {heading}
      </h1>

      <p className="mt-3 max-w-[46ch] text-[15px] leading-[1.6] text-text2 sm:text-[16px]">
        {sub}
      </p>

      {/* Grounding row — what the verdict is actually built from. Renders
          unconditionally so the greeting has substance even without a photo
          gallery (destinations may be empty in environments without an
          Unsplash key). */}
      <div className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
        {HOW_HOP_ANSWERS.map((item) => (
          <span key={item.label} className="flex items-center gap-2 text-[13px] font-medium text-text3">
            <Icon name={item.icon} size={16} className="text-brand" />
            {item.label}
          </span>
        ))}
      </div>

      {/* a proper inspiration gallery — larger paper cards than a hint-strip, so
          the empty state reads as one deliberate scene instead of a small
          greeting floating in a mostly-empty stage. Captions sit below the
          photo (no scrim needed), keeping it flat and editorial. Tapping one
          seeds a starter prompt. */}
      {destinations.length ? (
        <div className="mt-10 w-full">
          <p className="text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-text3">
            Or get inspired
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {destinations.map((d) => (
              <button
                key={d.city}
                type="button"
                onClick={() => onStarter(`Cheapest way to ${d.city}`)}
                aria-label={`Cheapest way to ${d.city}`}
                className="hop-press group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-paper transition-colors duration-200 ease-[var(--ease-premium)] hover:border-brand"
              >
                <span className="block h-[110px] w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.thumb}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </span>
                <span className="flex items-center gap-1.5 px-3 py-2.5">
                  <span
                    className={`fi fi-${d.countryCode} h-[10px] w-[14px] flex-shrink-0 rounded-[1px]`}
                    aria-hidden
                  />
                  <span className="truncate text-[13px] font-medium text-text2 transition-colors group-hover:text-brand">
                    {d.city}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
