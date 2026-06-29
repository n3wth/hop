'use client'

// THE shared conversational front door — one visual language, one voice.
//
// hop's single way in (talk to it) appears in two places: a teaser on the home
// hero and the full landing on /ask. Both render THIS component, so they can
// never drift into "two features that don't know about each other" again.
//
// Presentation only — it owns the look (photographic panel + scrim, eyebrow,
// heading, sub, composer, chips, optional mood gallery) and the copy (from
// lib/concierge-hero). Behavior is the caller's: the home wires submit to route
// into /ask?q=…; the /ask landing wires it to useChat. So the same hero drives a
// route push in one place and a streamed message in the other, identically drawn.
//
// Density:
//   • 'teaser' — home. Compact, no gallery/Gmail seam; the marketing promise
//     that, on submit, carries the visitor into /ask where the answer streams.
//   • 'full'   — /ask. Taller, with the mood gallery and the gets-to-know-you
//     affordances (Gmail seam, what-hop-remembers).
//
// Flat + on-brand: a brand-ink panel (an allowed surface) under a full-bleed
// photo as imagery, a single dark→ink scrim for legibility, solid white input,
// hover = color only (no lift), motion is reduced-motion-safe via .hop-rise.

import { useEffect, useRef, type FormEvent } from 'react'
import Icon from './Icon'
import { type ConciergeHeroCopy } from '@/lib/concierge-hero'

// A serializable photo record (the same shape both pages already pass down) so
// the hero can render real imagery without the Unsplash key on the client.
export interface ConciergeHeroPhoto {
  thumb: string
  alt: string
  city: string
  countryCode: string
}

export interface ConciergeHeroProps {
  /** Resolved copy (eyebrow/heading/sub/placeholder/chips) — one source. */
  copy: ConciergeHeroCopy
  /** Controlled composer value + setter (each surface owns its own state). */
  value: string
  onValueChange: (v: string) => void
  /** Submit the typed value. */
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  /** Tap a starter chip — sends that prompt straight through. */
  onChip: (prompt: string) => void
  /** 'teaser' (home) | 'full' (/ask). */
  density: 'teaser' | 'full'
  /** Disable submit (e.g. /ask while the agent is busy). Home leaves it false. */
  submitDisabled?: boolean
  /** Autofocus the input (the /ask landing does; the home does not steal focus). */
  autoFocus?: boolean
  /** Optional backdrop + mood-gallery photos. The first is the scrimmed
   *  backdrop; up to six tile the gallery base (full density only). */
  photos?: ConciergeHeroPhoto[]
  /** Signed-in unlocks the "what hop remembers" affordance (full density). */
  signedIn?: boolean
  /** Signed in but no programs linked yet → show the "Add your programs" nudge
   *  so the visitor knows answers will sharpen once balances are connected. */
  needsPrograms?: boolean
}

export default function ConciergeHero({
  copy,
  value,
  onValueChange,
  onSubmit,
  onChip,
  density,
  submitDisabled = false,
  autoFocus = false,
  photos = [],
  signedIn = false,
  needsPrograms = false,
}: ConciergeHeroProps) {
  const full = density === 'full'
  const tiles = photos.slice(0, 6)
  const backdrop = tiles[0]

  // autoFocus is gated to pointer:fine + wide viewports: on a phone, focusing the
  // input on mount pops the keyboard and buries the hero. We focus imperatively
  // after mount only when the device clearly has a hardware pointer and room.
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!autoFocus) return
    if (typeof window === 'undefined' || !window.matchMedia) return
    const ok = window.matchMedia('(pointer: fine) and (min-width: 768px)').matches
    if (ok) inputRef.current?.focus()
  }, [autoFocus])

  const panelMin = full
    ? 'min-h-[clamp(440px,72vh,680px)]'
    : '' // teaser sizes to its content

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-[var(--radius-hero)] ${panelMin}`}
      style={{ background: 'var(--color-brand-ink)' }}
    >
      {/* full-bleed photo as imagery (allowed), under a single legibility scrim */}
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
          // Stronger top stop so white eyebrow/heading clear WCAG AA even over a
          // bright backdrop photo (the lightest tiles previously thinned the top).
          background:
            'linear-gradient(to bottom, rgba(7,62,62,0.80) 0%, rgba(7,62,62,0.90) 55%, rgba(7,62,62,0.97) 100%)',
        }}
      />

      <div
        className={`relative flex flex-1 flex-col items-center px-5 text-center sm:px-10 ${
          full ? 'justify-center py-12' : 'py-12 sm:py-16'
        }`}
      >
        <span
          className="hop-rise inline-flex items-center gap-2 rounded-full bg-[#0a5757] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-hero-eyebrow"
          style={{ ['--hop-delay' as string]: '40ms' }}
        >
          <Icon name="lightbulb" size={13} />
          {copy.eyebrow}
        </span>

        <h1
          className={`hop-rise mt-6 max-w-[18ch] text-balance font-display font-semibold leading-[1.0] tracking-[-0.03em] text-white ${
            full ? 'text-[40px] sm:text-[64px]' : 'text-[36px] sm:text-[56px] lg:text-[64px]'
          }`}
          style={{ ['--hop-delay' as string]: '90ms' }}
        >
          {copy.heading}
        </h1>

        <p
          className="hop-rise mt-5 max-w-[52ch] text-pretty text-[15px] leading-[1.6] text-hero-body sm:text-[17px]"
          style={{ ['--hop-delay' as string]: '140ms' }}
        >
          {copy.sub}
        </p>

        {/* composer — the primary action, identical on both surfaces */}
        <form
          onSubmit={onSubmit}
          className="hop-rise mt-8 w-full max-w-[600px]"
          style={{ ['--hop-delay' as string]: '190ms' }}
        >
          <div className="flex items-center gap-2 rounded-[18px] bg-white px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
            <Icon name="lightbulb" size={20} className="flex-shrink-0 text-brand" />
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder={copy.placeholder}
              aria-label="Tell hop where you want to go"
              enterKeyHint="go"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-[16px] text-text outline-none placeholder:text-text3"
            />
            <button
              type="submit"
              aria-label="Ask hop"
              disabled={!value.trim() || submitDisabled}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-[#0a5757] disabled:text-[#5f9b97]"
            >
              <span className="hidden sm:inline">Ask hop</span>
              <Icon name="flight" size={16} className="rotate-90" />
            </button>
          </div>
        </form>

        {/* one-tap starters — one canonical set, same on both surfaces */}
        <div
          className="hop-rise mt-5 flex flex-wrap justify-center gap-2"
          style={{ ['--hop-delay' as string]: '240ms' }}
        >
          {copy.chips.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChip(p)}
              className="rounded-full border border-[#2c6f6b] bg-[#0a5757] px-3.5 py-1.5 text-[13px] font-medium text-hero-body transition-colors hover:border-wallet-active hover:text-hero-white-hover"
            >
              {p}
            </button>
          ))}
        </div>

        {/* full density only: gets-to-know-you affordances. Signed-out visitors
            don't see the disabled "Connect Gmail — Soon" pill (a dead control is
            noise before there's a relationship); they see nothing extra here. */}
        {full && signedIn ? (
          <div
            className="hop-rise mt-4 flex flex-wrap items-center justify-center gap-2"
            style={{ ['--hop-delay' as string]: '300ms' }}
          >
            {/* No programs yet → invite linking so answers price against real
                balances. The primary onward action for a fresh signed-in user. */}
            {needsPrograms ? (
              <a
                href="/account"
                className="flex items-center gap-1.5 rounded-full border border-wallet-active bg-wallet-active/15 px-3.5 py-1.5 text-[12px] font-semibold text-hero-white-hover transition-colors hover:bg-wallet-active/25"
              >
                <Icon name="loyalty" size={14} className="flex-shrink-0" />
                Add your programs
              </a>
            ) : null}
            <button
              type="button"
              disabled
              aria-disabled
              title="Coming soon — let hop learn from your past trips"
              className="flex cursor-not-allowed items-center gap-1.5 rounded-full border border-[#2c6f6b] bg-transparent px-3.5 py-1.5 text-[12px] font-medium text-hero-label"
            >
              <Icon name="loyalty" size={14} className="flex-shrink-0" />
              Connect Gmail to learn from past trips
              <span className="rounded-full bg-[#0a5757] px-1.5 py-px text-[10px] uppercase tracking-wide text-hero-body">
                Soon
              </span>
            </button>
            <a
              href="/account"
              className="flex items-center gap-1.5 rounded-full border border-[#2c6f6b] bg-transparent px-3.5 py-1.5 text-[12px] font-medium text-hero-label transition-colors hover:border-wallet-active hover:text-hero-white-hover"
            >
              <Icon name="info" size={14} className="flex-shrink-0" />
              What hop remembers
            </a>
          </div>
        ) : null}
      </div>

      {/* full density only: mood gallery — sets the tone at the base of the panel */}
      {full && tiles.length > 0 ? (
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
