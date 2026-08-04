'use client'

// The conversational front door TEASER — the home hero's compact way in to
// hop's agent. The /ask landing's empty state now renders its own component
// (components/concierge/AskStart) instead of this one, but the two still
// share one voice via lib/concierge-hero's copy (conciergeHeroCopy), so a chip
// tapped here and the greeting on /ask never drift into two different products.
//
// Presentation only — it owns the look (photographic panel + scrim, eyebrow,
// heading, sub, composer, chips) and renders the copy from lib/concierge-hero.
// Behavior is the caller's: AgentComposer wires submit to route into /ask?q=….
//
// Flat + on-brand: a brand-ink panel (an allowed surface) under a full-bleed
// photo as imagery, a single dark→ink scrim for legibility, solid white input,
// hover = color only (no lift), motion is reduced-motion-safe via .hop-rise.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Icon from './Icon'
import { type ConciergeHeroCopy } from '@/lib/concierge-hero'

// A serializable photo record (the same shape both pages already pass down) so
// the hero can render real imagery without the Unsplash key on the client.
export interface ConciergeHeroPhoto {
  thumb: string
  alt: string
  city: string
  countryCode: string
  /** Unsplash attribution (API terms) — optional only so a hand-built caller
   *  without a real photo doesn't need to fake one; every photo actually
   *  resolved via lib/images.ts#DestImage carries one. */
  credit?: { name: string; link: string; source?: string; sourceLink?: string }
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
  /** Disable submit. Home leaves it false. */
  submitDisabled?: boolean
  /** Autofocus the input (the home does not steal focus by default). */
  autoFocus?: boolean
  /** Optional backdrop photos — the first is the scrimmed backdrop; several
   *  cross-fade the backdrop slowly through them (see `rotating` below). */
  photos?: ConciergeHeroPhoto[]
  /** Heading level for the hero title. Defaults to h1; pass 'h2' where another
   *  element owns the page's h1 (the signed-out home, where the verdict hero
   *  leads and this is the second door). */
  headingTag?: 'h1' | 'h2'
  /** Lazy-load the backdrop photo. Only pass true when this hero is confirmed
   *  BELOW the fold (e.g. the signed-out home's "second door", which renders
   *  after the verdict hero + reel) — never for a hero that's a page's likely
   *  LCP image (signed-in home's front-door composer). Defaults to eager. */
  lazyBackdrop?: boolean
}

export default function ConciergeHero({
  copy,
  value,
  onValueChange,
  onSubmit,
  onChip,
  submitDisabled = false,
  autoFocus = false,
  photos = [],
  headingTag: HeadingTag = 'h1',
  lazyBackdrop = false,
}: ConciergeHeroProps) {
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

  // Backdrop rotation — when the caller passes several photos, the scrim
  // photo slowly cross-fades through them so the panel feels alive. Reduced
  // motion → static first photo (the effect never starts).
  const [backdropIdx, setBackdropIdx] = useState(0)
  const rotating = tiles.length > 1
  useEffect(() => {
    if (!rotating) return
    if (typeof window === 'undefined' || !window.matchMedia) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => setBackdropIdx((v) => v + 1), 7600)
    return () => window.clearInterval(t)
  }, [rotating])

  // Attribution (Unsplash API terms) for whichever backdrop photo is actually
  // on screen right now — the rotating tile when cross-fading, else the
  // single static backdrop.
  const activeCredit = rotating ? tiles[backdropIdx % tiles.length]?.credit : backdrop?.credit

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-[var(--radius-hero)]"
      style={{ background: 'var(--color-brand-ink)' }}
    >
      {/* full-bleed photo as imagery (allowed), under a single legibility scrim.
          Several photos → a slow cross-fade through them (opacity only; the
          scrim above holds legibility constant throughout). The active tile
          eager-loads unless lazyBackdrop says this hero is below the fold. */}
      {rotating ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 hop-rotator">
          {tiles.map((t, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={t.thumb + i}
              src={t.thumb}
              alt=""
              loading={i === 0 && !lazyBackdrop ? undefined : 'lazy'}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ${
                i === backdropIdx % tiles.length ? 'opacity-35' : 'opacity-0'
              }`}
            />
          ))}
        </div>
      ) : backdrop ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backdrop.thumb}
          alt=""
          aria-hidden
          loading={lazyBackdrop ? 'lazy' : undefined}
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

      {/* Unsplash attribution (API terms) for the backdrop currently on
          screen — a small solid chip, not a shadow/gradient surface. */}
      {activeCredit ? (
        <div
          className="pointer-events-auto absolute right-3 top-3 z-10 max-w-[70%] truncate rounded-full px-2.5 py-1 text-[10px] font-medium text-white/70"
          style={{ background: 'rgba(7,26,26,0.5)' }}
        >
          Photo by{' '}
          <a
            href={`${activeCredit.link}?utm_source=hop&utm_medium=referral`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-white/40 underline-offset-2 hover:text-white"
          >
            {activeCredit.name}
          </a>{' '}
          on{' '}
          <a
            href={activeCredit.sourceLink ?? 'https://unsplash.com/?utm_source=hop&utm_medium=referral'}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-white/40 underline-offset-2 hover:text-white"
          >
            {activeCredit.source ?? 'Unsplash'}
          </a>
        </div>
      ) : null}

      {/* Content: centered in the available space. */}
      <div className="relative flex flex-1 flex-col items-center px-5 py-16 text-center sm:px-10 sm:py-24">
        <span
          className="hop-rise inline-flex items-center gap-2 rounded-full bg-brand-deep px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[var(--track-tag)] text-hero-eyebrow"
          style={{ ['--hop-delay' as string]: '40ms' }}
        >
          <Icon name="lightbulb" size={12} />
          {copy.eyebrow}
        </span>

        <HeadingTag
          className="hop-rise mt-7 max-w-[18ch] text-balance font-display text-[38px] font-semibold leading-[0.98] tracking-[-0.03em] text-white sm:text-[60px] lg:text-[72px]"
          style={{ ['--hop-delay' as string]: '90ms' }}
        >
          {copy.heading}
        </HeadingTag>

        <p
          className="hop-rise mt-5 max-w-[52ch] text-pretty text-[15px] leading-[1.6] text-hero-body sm:text-[17px]"
          style={{ ['--hop-delay' as string]: '140ms' }}
        >
          {copy.sub}
        </p>

        {/* composer — the primary action */}
        <form
          onSubmit={onSubmit}
          className="hop-rise mt-8 w-full max-w-[600px]"
          style={{ ['--hop-delay' as string]: '190ms' }}
        >
          <div className="flex items-center gap-2 rounded-[16px] border-2 border-transparent bg-white py-2 pl-5 pr-2 transition-colors focus-within:border-brand sm:gap-3 sm:py-2.5">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder={copy.placeholder}
              aria-label="Tell hop where you want to go"
              enterKeyHint="go"
              className="no-inner-ring min-w-0 flex-1 bg-transparent py-1.5 text-[16px] font-medium text-text outline-none placeholder:font-normal placeholder:text-text3"
            />
            <button
              type="submit"
              aria-label="Ask hop"
              disabled={!value.trim() || submitDisabled}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-[12px] bg-brand px-5 py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-brand-deep disabled:text-hero-label hop-press"
            >
              Ask hop
              <span aria-hidden className="text-[15px] leading-none">→</span>
            </button>
          </div>
        </form>

        {/* one-tap starters — one canonical set */}
        <div
          className="hop-rise mt-6 flex w-full max-w-[560px] flex-wrap justify-center gap-2"
          style={{ ['--hop-delay' as string]: '240ms' }}
        >
          {copy.chips.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChip(p)}
              className="rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-[13.5px] font-medium text-hero-cream transition-colors hover:border-mint-bright hover:bg-white/20 hover:text-white"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
